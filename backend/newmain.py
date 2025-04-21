from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, List
from datetime import datetime, timedelta, time
import os
from jose import JWTError, jwt
from sqlalchemy import ForeignKey, case, extract
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    Enum,
    JSON,
    DATETIME,
    Time,
)
from sqlalchemy.orm import Session, sessionmaker, relationship
from sqlalchemy.sql import func
import pandas as pd
import uuid
from pathlib import Path
from fastapi import BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import shutil
from datetime import date
from fastapi.responses import StreamingResponse
from typing import Annotated
from fastapi.responses import FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from models import *
from schemas import *
from utils import *
import zipfile
from io import BytesIO
import math

# Create a FastAPI instance
app = FastAPI()
# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Endpoint for user registration
@app.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    db_user_email = db.query(UserModel).filter(UserModel.email == user.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = hash_password(user.password)
    db_user = UserModel(
        username=user.username,
        hashed_password=hashed_password,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        disabled=user.disabled,
    )
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# Endpoint for user login and token generation
@app.post("/login", response_model=Token)
async def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(UserModel).filter(UserModel.username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    if user.disabled:
        raise HTTPException(status_code=400, detail="User account is disabled")

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")


@app.put("/change_pass", response_model=MessageResponse)
async def change_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(UserModel).filter(UserModel.username == password_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )
    user.hashed_password= hash_password(password_data.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Passsword changed sucessfully"}


@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


@app.get("/users")
async def read_users(
    current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    result = []
    data = db.query(UserModel).all()
    for row in data:
        user = {"id": row.id, "name": row.username}
        result.append(user)
    return result


@app.post("/process_folder_pf", response_model=FileProcessResult)
async def process_folder(
    folder_path: str = Form(..., min_length=3, max_length=500),
    current_user: UserModel = Depends(require_hr_or_admin),
    upload_date: str = Form(..., description="Date of Upload in YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    try:
        upload_date_obj = datetime.strptime(upload_date, "%Y-%m-%d").date()
        date_folder_name = upload_date_obj.strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Please use YYYY-MM-DD format"
        )
    folder = Path(folder_path)
    if not folder_path.strip():
        raise HTTPException(status_code=422, detail="Folder path cannot be empty")
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFilePF(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)

    excel_files = list(folder.glob("*.xls*"))
    if not excel_files:
        error_message = f"No Excel files found in the folder: {folder_path}"
        db_file = ProcessedFilePF(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)

    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."
    excel_output_dir = Path("processed_excels_pf_new") / date_folder_name
    text_output_dir = Path("processed_texts_pf_new") / date_folder_name
    excel_output_dir.mkdir(parents=True, exist_ok=True)
    text_output_dir.mkdir(parents=True, exist_ok=True)

    for excel_file in excel_files:
        try:
            try:
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file, dtype={"UAN No": str})
                else:
                    df = pd.read_excel(excel_file, engine="xlrd", dtype={"UAN No": str})

                if df.empty:
                    error_message = f"Excel file {excel_file.name} is empty."
                    db_file = ProcessedFilePF(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue

            except Exception as e:
                error_message = f"Error reading Excel file {excel_file.name}: {str(e)}"
                db_file = ProcessedFilePF(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )
                continue
            try:
                # Check for required columns with alternative names
                required_columns = {
                    "UAN No": ["UAN No"],
                    "Employee Name": ["Employee Name"],
                    "Gross Wages": ["Total Salary", "Gross Salary"],
                    "EPF Wages": ["PF Gross", "EPF Gross"],
                    "LOP Days": ["LOP", "LOP Days"],
                }

                # Find actual column names in the DataFrame
                column_mapping = {}
                missing_columns = []

                for field, alternatives in required_columns.items():
                    found = False
                    for alt in alternatives:
                        if alt in df.columns:
                            column_mapping[field] = alt
                            found = True
                            break
                    if not found:
                        missing_columns.append(field)

                if missing_columns:
                    error_message = f"Missing required columns in {excel_file.name}: {', '.join(missing_columns)}"
                    db_file = ProcessedFilePF(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue

                # Process the data with correct logic
                uan_no = df[column_mapping["UAN No"]].astype(str).str.replace("-", "")
                member_name = df[column_mapping["Employee Name"]]
                gross_wages = (
                    df[column_mapping["Gross Wages"]].fillna(0).round().astype(int)
                )
                epf_wages = (
                    df[column_mapping["EPF Wages"]].fillna(0).round().astype(int)
                )
                lop_days_raw = df[column_mapping["LOP Days"]]

                def custom_round(x):
                    if pd.isna(x):
                        return 0
                    decimal_part = x - int(x)
                    if decimal_part >= 0.5:
                        return math.ceil(x)
                    else:
                        return math.floor(x)

                lop_days = lop_days_raw.apply(custom_round)
                # non_textual_rows = df[~df["Employee Name"].astype(str).str.contains("total", case=False, na=False)]
                # Calculate derived fields
                eps_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = (epf_wages * 0.12).round().astype(int)
                eps_contrib_remitted = (eps_wages * 0.0833).round().astype(int)  # 8.33%
                epf_eps_diff_remitted = (
                    epf_contrib_remitted - eps_contrib_remitted
                ).astype(int)
                ncp_days = lop_days
                refund_of_advances = 0

                output_df = pd.DataFrame(
                    {
                        "UAN No": uan_no,
                        "MEMBER NAME": member_name,
                        "GROSS WAGES": gross_wages,
                        "EPF Wages": epf_wages,
                        "EPS Wages": eps_wages,
                        "EDLI WAGES": edli_wages,
                        "EPF CONTRI REMITTED": epf_contrib_remitted,
                        "EPS CONTRI REMITTED": eps_contrib_remitted,
                        "EPF EPS DIFF REMITTED": epf_eps_diff_remitted,
                        "NCP DAYS": ncp_days,
                        "REFUND OF ADVANCES": refund_of_advances,
                    }
                )

                # Create output directories if they don't exist
                """excel_output_dir = Path("processed_excels_pf")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_pf")
                text_output_dir.mkdir(parents=True, exist_ok=True)"""

                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename
                output_df.to_excel(excel_file_path, index=False)
                # Prepare text file conten

                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)

                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))

                # Save to database
                db_file = ProcessedFilePF(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=f"{str(excel_file_path)},{str(text_file_path)}",
                    status="success",
                    message="File processed successfully.",
                    upload_date=upload_date_obj,
                )
                db.add(db_file)
                db.commit()
                processed_files.append(
                    FileProcessResult(
                        file_path=f"{str(excel_file_path)},{str(text_file_path)}",
                        status="success",
                        message="File processed successfully.",
                    )
                )

            except Exception as e:
                error_message = f"Error processing file {excel_file.name}: {str(e)}"
                db_file = ProcessedFilePF(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )

        except Exception as e:
            error_message = f"Unexpected error processing folder: {str(e)}"
            db_file = ProcessedFilePF(
                user_id=current_user.id,
                filename="N/A",
                filepath=folder_path,
                status="error",
                message=error_message,
            )
            db.add(db_file)
            db.commit()
            raise HTTPException(status_code=500, detail=error_message)

    return FileProcessResult(
        file_path=folder_path,
        status=overall_status,
        message=overall_message,
        upload_date=upload_date_obj,
    )


@app.get("/processed_files_pf", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    upload_date: date = Query(..., description="Date of upload in YYYY-MM-DD format"),
    current_user: UserModel = Depends(get_current_user),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    db: Session = Depends(get_db),
):
    query = db.query(ProcessedFilePF).filter(ProcessedFilePF.upload_date == upload_date)
    if current_user.role == Role.ADMIN:
        # Admin can see all files or filter by specific user_id
        if user_id is not None:
            query = query.filter(ProcessedFilePF.user_id == user_id)
    elif current_user.role == Role.HR:
        # HR can only see their own files
        query = query.filter(ProcessedFilePF.user_id == current_user.id)
    else:
        # Regular users can only see their own files
        query = query.filter(ProcessedFilePF.user_id == current_user.id)
    files = query.order_by(ProcessedFilePF.created_at.desc()).all()
    valid_files = []
    for file in files:
        if file.status == "success":
            filepaths = file.filepath.split(",")
            if len(filepaths) == 2:
                excel_path = Path(filepaths[0])
                text_path = Path(filepaths[1])
                if excel_path.exists() and text_path.exists():
                    valid_files.append(file)
        else:
            valid_files.append(file)
    return [ProcessedFileResponse.from_orm(file) for file in valid_files]


@app.post("/processed_files_pf/{file_id}/submit_remittance")
async def submit_remittance(
    file_id: int,
    remittance_date: date = Form(...),
    remittance_file: UploadFile = File(...),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    # Validate file
    if not remittance_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Get the file record
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="You don't have permission to update this file"
        )

    # Create remittance directory if not exists
    remittance_dir = (
        Path("remittance_challans")
        / str(file.upload_date.year)
        / str(file.upload_date.month)
    )
    remittance_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_ext = remittance_file.filename.split(".")[-1]
    new_filename = f"remittance_{file_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = remittance_dir / new_filename

    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(remittance_file.file, buffer)

    # Update database record
    file.remittance_submitted = True
    file.remittance_date = remittance_date
    file.remittance_challan_path = str(file_path)
    db.commit()

    return {"message": "Remittance submitted successfully", "file_path": str(file_path)}


# New endpoint to download remittance challan
@app.get("/processed_files_pf/{file_id}/remittance_challan")
async def download_remittance_challan(
    file_id: int,
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if not file.remittance_submitted or not file.remittance_challan_path:
        raise HTTPException(status_code=404, detail="No remittance challan found")

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="You don't have permission to access this file"
        )

    if not Path(file.remittance_challan_path).exists():
        raise HTTPException(
            status_code=404, detail="Remittance file not found on server"
        )

    return FileResponse(
        file.remittance_challan_path,
        filename=f"remittance_challan_{file_id}.pdf",
        media_type="application/pdf",
    )


@app.get("/processed_files_pf/{file_id}/download")
async def download_pf_file(
    file_id: int,
    file_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the file record from the database
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if user has access to this file
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only download your own files",
        )

    # Check if the file status is 'success'
    if file.status != "success":
        raise HTTPException(
            status_code=400, detail="Cannot download file with non-success status"
        )

    # The filepath field contains both excel and text filepaths separated by comma
    filepaths = file.filepath.split(",")

    if len(filepaths) != 2:
        raise HTTPException(
            status_code=500, detail="Invalid file path format in database"
        )
    date_folder = file.upload_date.strftime("%Y-%m-%d") if file.upload_date else ""
    excel_path = Path("processed_excels_pf_new") / date_folder / Path(filepaths[0]).name
    text_path = Path("processed_texts_pf_new") / date_folder / Path(filepaths[1]).name

    # Determine which file to download based on file_type query parameter
    if file_type and file_type.lower() == "txt":
        file_path = text_path
        media_type = "text/plain"
    else:
        # Default to Excel if file_type is not specified or is not "txt"
        file_path = excel_path
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Verify the file exists
    if not file_path.exists():
        fallback_path = Path(
            text_path if file_type and file_type.lower() == "txt" else excel_path
        )
        if not fallback_path.exists():
            raise HTTPException(
                status_code=404, detail=f"File not found on server: {file_path}"
            )
        file_path = fallback_path

    # Get the original filename from the file record
    original_filename = file.filename

    # Create appropriate download filename based on file type
    if file_type and file_type.lower() == "txt":
        # For text file, use the original filename but change extension to .txt
        filename = os.path.splitext(original_filename)[0] + ".txt"
    else:
        # For Excel, keep the original filename (which should already have .xlsx/.xls extension)
        filename = original_filename

    # Return file as a response
    return FileResponse(path=file_path, filename=filename, media_type=media_type)


@app.get("/directory_files_pf", response_model=Dict[str, List[DirectoryFile]])
async def list_esi_directory_files(
    current_user: UserModel = Depends(get_current_user),
):
    excel_dir = "D:\\MyProject\\backend\\processed_excels_pf"
    text_dir = "D:\\MyProject\\backend\\processed_texts_pf"

    # Check if directories exist
    if not os.path.exists(excel_dir):
        raise HTTPException(
            status_code=404, detail=f"Excel directory not found: {excel_dir}"
        )
    if not os.path.exists(text_dir):
        raise HTTPException(
            status_code=404, detail=f"Text directory not found: {text_dir}"
        )

    # Get Excel files
    excel_files = []
    for filename in os.listdir(excel_dir):
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            filepath = os.path.join(excel_dir, filename)
            file_stats = os.stat(filepath)
            excel_files.append(
                DirectoryFile(
                    filename=filename,
                    filepath=filepath,
                    size=file_stats.st_size,
                    created_at=datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                    type="excel",
                )
            )

    # Get Text files
    text_files = []
    for filename in os.listdir(text_dir):
        if filename.endswith(".txt"):
            filepath = os.path.join(text_dir, filename)
            file_stats = os.stat(filepath)
            text_files.append(
                DirectoryFile(
                    filename=filename,
                    filepath=filepath,
                    size=file_stats.st_size,
                    created_at=datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                    type="text",
                )
            )

    return {"excel_files": excel_files, "text_files": text_files}


# Add this endpoint to download files directly from directories
@app.get("/directory_files_pf/{file_type}/{filename}")
async def download_directory_file(
    file_type: str,
    filename: str,
    current_user: UserModel = Depends(require_hr_or_admin),
):
    # Validate file_type
    if file_type not in ["excel", "text"]:
        raise HTTPException(
            status_code=400, detail="Invalid file type. Must be 'excel' or 'text'"
        )

    # Determine directory based on file type
    base_dir = (
        "D:\\MyProject\\backend\\processed_excels"
        if file_type == "excel"
        else "D:\\MyProject\\backend\\processed_texts"
    )

    # Construct full file path
    file_path = os.path.join(base_dir, filename)

    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    # Determine media type
    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if file_type == "excel"
        else "text/plain"
    )

    # Return file as a response
    return FileResponse(path=file_path, filename=filename, media_type=media_type)


@app.get("/processed_files_pf/batch_download")
async def download_multiple_pf_files(
    file_ids: str = Query(..., description="Comma-separated list of file IDs"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    try:
        # Convert comma-separated string to list of integers
        file_ids_list = [int(id) for id in file_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file IDs format")
    files = (
        db.query(ProcessedFilePF).filter(ProcessedFilePF.id.in_(file_ids_list)).all()
    )
    if not files:
        raise HTTPException(status_code=404, detail="No files found")
    for file in files:
        if current_user.role == Role.USER and file.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only download your own files",
            )

        if file.status != "success":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot download file with ID {file.id} - status is not 'success'",
            )
    zip_buffer = BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file in files:
            # Get both file paths (Excel and text)
            filepaths = file.filepath.split(",")

            if len(filepaths) != 2:
                continue  # skip invalid entries
            date_folder = (
                file.upload_date.strftime("%Y-%m-%d") if file.upload_date else ""
            )
            excel_path = (
                Path("processed_excels_pf_new") / date_folder / Path(filepaths[0]).name
            )
            text_path = (
                Path("processed_texts_pf_new") / date_folder / Path(filepaths[1]).name
            )

            # Add both files to the zip with appropriate names
            original_name = os.path.splitext(file.filename)[0]
            zip_dir = f"{date_folder}/{original_name}" if date_folder else original_name
            if excel_path.exists():
                zip_file.write(excel_path, f"{zip_dir}/{original_name}.xlsx")
            elif Path(filepaths[0]).exists():
                zip_file.write(Path(filepaths[0]), f"{zip_dir}/{original_name}.xlsx")
            if text_path.exists():
                zip_file.write(text_path, f"{zip_dir}/{original_name}.txt")
            elif Path(filepaths[1]).exists():  # Fallback to original path
                zip_file.write(Path(filepaths[1]), f"{zip_dir}/{original_name}.txt")
    if zipfile.ZipFile(zip_buffer, "r").testzip() is not None:
        raise HTTPException(status_code=404, detail="No valid files found for download")

    # Return the zip file
    zip_buffer.seek(0)

    def cleanup():
        zip_buffer.close()

    background_tasks.add_task(cleanup)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            f"Content-Disposition": "attachment; filename=pf_files_bundle_{timestamp}.zip",
            "Content-Type": "application/zip",
        },
        background=background_tasks,
    )


# **********************************************************************************#
@app.post("/esi_upload", response_model=FileProcessResult)
async def process_esi_file(
    folder_path: str = Form(...),
    upload_date: str = Form(..., description="Date of Upload in YYYY-MM-DD format"),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    try:
        # Validate the upload date format
        upload_date_obj = datetime.strptime(upload_date, "%Y-%m-%d").date()
        date_folder_name = upload_date_obj.strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Please use YYYY-MM-DD format"
        )
    folder = Path(folder_path)
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFileESI(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)

    excel_files = list(folder.glob("*.xls*"))
    if not excel_files:
        error_message = f"No Excel files found in the folder: {folder_path}"
        db_file = ProcessedFileESI(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)
    excel_output_dir = Path("processed_excels_esi_new") / date_folder_name
    text_output_dir = Path("processed_texts_esi_new") / date_folder_name
    excel_output_dir.mkdir(parents=True, exist_ok=True)
    text_output_dir.mkdir(parents=True, exist_ok=True)
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."

    for excel_file in excel_files:
        try:
            try:
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file, dtype={"ESI N0": str})
                else:
                    df = pd.read_excel(excel_file, engine="xlrd", dtype={"ESI N0": str})

                if df.empty:
                    error_message = f"Excel file {excel_file.name} is empty."
                    db_file = ProcessedFileESI(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue

            except Exception as e:
                error_message = f"Error reading Excel file {excel_file.name}: {str(e)}"
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )
                continue

            try:
                required_columns = {
                    "ESI No": ["ESI N0"],
                    "Employee Name": ["Employee Name"],
                    "ESI Gross": ["ESI Gross"],
                    "Worked Days": ["Worked days"],
                }

                column_mapping = {}
                missing_columns = []

                for field, alternatives in required_columns.items():
                    found = False
                    for alt in alternatives:
                        if alt in df.columns:
                            column_mapping[field] = alt
                            found = True
                            break
                    if not found:
                        missing_columns.append(field)

                if missing_columns:
                    error_message = f"Missing required columns in {excel_file.name}: {', '.join(missing_columns)}"
                    db_file = ProcessedFileESI(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue
                # Filter out rows where ESI number is invalid
                esi_column = df[column_mapping["ESI No"]]

                # Create mask to identify valid ESI numbers (not 0, not null, not NaN, not empty)
                valid_esi_mask = ~(
                    (esi_column == 0)
                    | (esi_column == "0")
                    | (esi_column == "0.0")
                    | (esi_column.isna())
                    | (esi_column.isnull())
                    | (esi_column == "")
                )

                # Filter the dataframe to keep only rows with valid ESI numbers
                # df = df[valid_esi_mask]
                esi_column_gross = df[column_mapping["ESI Gross"]]
                valid_esi_gross_mask = ~(
                    (esi_column_gross == 0)
                    | (esi_column_gross.isna())
                    | (esi_column_gross.isnull())
                )
                # df = df[esi_column_gross]
                valid_rows_mask = valid_esi_mask & valid_esi_gross_mask
                df = df[valid_rows_mask]
                # Check if we still have data after filtering
                if df.empty:
                    error_message = f"No valid ESI data found in {excel_file.name} after filtering invalid entries"
                    db_file = ProcessedFileESI(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue

                # Now process the valid ESI numbers
                esi_no = df[column_mapping["ESI No"]].astype(str).str.replace("-", "")
                member_name = df[column_mapping["Employee Name"]]
                esi_gross = (
                    df[column_mapping["ESI Gross"]].fillna(0).round().astype(int)
                )

                # Apply custom rounding to Worked Days (same logic as LOP days)
                worked_days_raw = df[column_mapping["Worked Days"]]

                # Custom rounding function: ≥5 round up, <5 round down
                def custom_round(x):
                    if pd.isna(x):
                        return 0
                    decimal_part = x - int(x)
                    if decimal_part >= 0.5:
                        return math.ceil(x)  # Round up
                    else:
                        return math.floor(x)  # Round down

                worked_days = worked_days_raw.apply(custom_round)

                output_df = pd.DataFrame(
                    {
                        "ESI No": esi_no,
                        "MEMBER NAME": member_name,
                        "ESI GROSS": esi_gross,
                        "WORKED DAYS": worked_days,
                    }
                )

                # Create output directories if they don't exist
                """excel_output_dir = Path("processed_excels_esi")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_esi")
                text_output_dir.mkdir(parents=True, exist_ok=True)"""

                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}_esi.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}_esi.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename

                output_df.to_excel(excel_file_path, index=False, float_format="%.0f")

                # Prepare text file content
                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)

                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))

                # Save to database
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=f"{str(excel_file_path)},{str(text_file_path)}",
                    status="success",
                    message="File processed successfully.",
                    upload_date=upload_date_obj,
                )
                db.add(db_file)
                db.commit()

                processed_files.append(
                    FileProcessResult(
                        file_path=f"{str(excel_file_path)},{str(text_file_path)}",
                        status="success",
                        message="File processed successfully.",
                    )
                )

            except Exception as e:
                error_message = f"Error processing file {excel_file.name}: {str(e)}"
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )

        except Exception as e:
            error_message = f"Unexpected error processing folder: {str(e)}"
            db_file = ProcessedFileESI(
                user_id=current_user.id,
                filename="N/A",
                filepath=folder_path,
                status="error",
                message=error_message,
            )
            db.add(db_file)
            db.commit()
            raise HTTPException(status_code=500, detail=error_message)

    return FileProcessResult(
        file_path=folder_path,
        status=overall_status,
        message=overall_message,
        upload_date=upload_date_obj,
    )


@app.get("/directory_files_esi", response_model=Dict[str, List[DirectoryFile]])
async def list_esi_directory_files(
    current_user: UserModel = Depends(require_hr_or_admin),
):
    excel_dir = "D:\\MyProject\\backend\\processed_excels_esi"
    text_dir = "D:\\MyProject\\backend\\processed_texts_esi"

    # Check if directories exist
    if not os.path.exists(excel_dir):
        raise HTTPException(
            status_code=404, detail=f"Excel directory not found: {excel_dir}"
        )
    if not os.path.exists(text_dir):
        raise HTTPException(
            status_code=404, detail=f"Text directory not found: {text_dir}"
        )

    # Get Excel files
    excel_files = []
    for filename in os.listdir(excel_dir):
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            filepath = os.path.join(excel_dir, filename)
            file_stats = os.stat(filepath)
            excel_files.append(
                DirectoryFile(
                    filename=filename,
                    filepath=filepath,
                    size=file_stats.st_size,
                    created_at=datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                    type="excel",
                )
            )

    # Get Text files
    text_files = []
    for filename in os.listdir(text_dir):
        if filename.endswith(".txt"):
            filepath = os.path.join(text_dir, filename)
            file_stats = os.stat(filepath)
            text_files.append(
                DirectoryFile(
                    filename=filename,
                    filepath=filepath,
                    size=file_stats.st_size,
                    created_at=datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                    type="text",
                )
            )

    return {"excel_files": excel_files, "text_files": text_files}


@app.get("/processed_files_esi", response_model=List[ProcessedFileResponse])
async def get_processed_files_esi(
    upload_date: date = Query(..., description="Date of upload in YYYY-MM-DD format"),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ProcessedFileESI).filter(
        ProcessedFileESI.upload_date == upload_date
    )
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFileESI.user_id == user_id)
    else:
        query = query.filter(ProcessedFileESI.user_id == current_user.id)

    files = query.order_by(ProcessedFileESI.created_at.desc()).all()
    valid_files = []
    for file in files:
        if file.status == "success":
            filepaths = file.filepath.split(",")
            if len(filepaths) == 2:
                excel_path = Path(filepaths[0])
                text_path = Path(filepaths[1])
                if excel_path.exists() and text_path.exists():
                    valid_files.append(file)
        else:
            valid_files.append(file)
    return [ProcessedFileResponse.from_orm(file) for file in valid_files]


@app.get("/processed_files_esi/{file_id}/download")
async def download_esi_file(
    file_id: int,
    file_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the file record from the database
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if user has access to this file
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only download your own files",
        )

    # Check if the file status is 'success'
    if file.status != "success":
        raise HTTPException(
            status_code=400, detail="Cannot download file with non-success status"
        )

    # The filepath field contains both excel and text filepaths separated by comma
    filepaths = file.filepath.split(",")

    if len(filepaths) != 2:
        raise HTTPException(
            status_code=500, detail="Invalid file path format in database"
        )
    date_folder = file.upload_date.strftime("%Y-%m-%d") if file.upload_date else ""

    excel_path = (
        Path("processed_excels_esi_new") / date_folder / Path(filepaths[0]).name
    )
    text_path = Path("processed_texts_esi_new") / date_folder / Path(filepaths[1]).name

    # Determine which file to download based on file_type query parameter
    if file_type and file_type.lower() == "txt":
        file_path = text_path
        media_type = "text/plain"
    else:
        # Default to Excel if file_type is not specified or is not "txt"
        file_path = excel_path
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Verify the file exists
    if not file_path.exists():
        fallback_path = Path(
            text_path if file_type and file_type.lower() == "txt" else excel_path
        )
        if not fallback_path.exists():
            raise HTTPException(
                status_code=404, detail=f"File not found on server: {file_path}"
            )
        file_path = fallback_path
    # Get the original filename from the file record
    original_filename = file.filename

    # Create appropriate download filename based on file type
    if file_type and file_type.lower() == "txt":
        # For text file, use the original filename but change extension to .txt
        filename = os.path.splitext(original_filename)[0] + ".txt"
    else:
        # For Excel, keep the original filename (which should already have .xlsx/.xls extension)
        filename = original_filename

    # Return file as a response
    return FileResponse(path=file_path, filename=filename, media_type=media_type)


@app.get("/processed_files_esi/batch_download")
async def download_multiple_esi_files(
    file_ids: str = Query(..., description="Comma-separated list of file IDs"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    try:
        # Convert comma-separated string to list of integers
        file_ids_list = [int(id) for id in file_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file IDs format")

    # Get all requested files from the database
    files = (
        db.query(ProcessedFileESI).filter(ProcessedFileESI.id.in_(file_ids_list)).all()
    )

    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    # Verify user has access to all requested files
    for file in files:
        if current_user.role == Role.USER and file.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only download your own files",
            )

        if file.status != "success":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot download file with ID {file.id} - status is not 'success'",
            )

    # Create in-memory zip file
    zip_buffer = BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file in files:
            # Get both file paths (Excel and text)
            filepaths = file.filepath.split(",")

            if len(filepaths) != 2:
                continue  # skip invalid entries

            date_folder = (
                file.upload_date.strftime("%Y-%m-%d") if file.upload_date else ""
            )
            excel_path = (
                Path("processed_excels_esi_new") / date_folder / Path(filepaths[0]).name
            )
            text_path = (
                Path("processed_texts_esi_new") / date_folder / Path(filepaths[1]).name
            )

            # Add both files to the zip with appropriate names
            original_name = os.path.splitext(file.filename)[0]
            zip_dir = f"{date_folder}/{original_name}" if date_folder else original_name
            if excel_path.exists():
                zip_file.write(excel_path, f"{zip_dir}/{original_name}.xlsx")
            elif Path(filepaths[0]).exists():
                zip_file.write(Path(filepaths[0]), f"{zip_dir}/{original_name}.xlsx")
            if text_path.exists():
                zip_file.write(text_path, f"{zip_dir}/{original_name}.txt")
            elif Path(filepaths[1]).exists():
                zip_file.write(Path(filepaths[1]), f"{zip_dir}/{original_name}.txt")
    if zipfile.ZipFile(zip_buffer, "r").testzip() is not None:
        raise HTTPException(status_code=404, detail="No valid files found for download")
    # Return the zip file
    zip_buffer.seek(0)

    def cleanup():
        zip_buffer.close()

    background_tasks.add_task(cleanup)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            f"Content-Disposition": "attachment; filename=esi_files_bundle_{timestamp}.zip",
            "Content-Type": "application/zip",
        },
        background=background_tasks,
    )


@app.post("/processed_files_esi/{file_id}/submit_remittance")
async def submit_remittance(
    file_id: int,
    remittance_date: date = Form(...),
    remittance_file: UploadFile = File(...),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    # Validate file
    if not remittance_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Get the file record
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="You don't have permission to update this file"
        )

    # Create remittance directory if not exists
    remittance_dir = (
        Path("remittance_challans")
        / str(file.upload_date.year)
        / str(file.upload_date.month)
    )
    remittance_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_ext = remittance_file.filename.split(".")[-1]
    new_filename = f"remittance_{file_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = remittance_dir / new_filename

    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(remittance_file.file, buffer)

    # Update database record
    file.remittance_submitted = True
    file.remittance_date = remittance_date
    file.remittance_challan_path = str(file_path)
    db.commit()

    return {"message": "Remittance submitted successfully", "file_path": str(file_path)}


@app.get("/processed_files_esi/{file_id}/remittance_challan")
async def download_remittance_challan(
    file_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if not file.remittance_submitted or not file.remittance_challan_path:
        raise HTTPException(status_code=404, detail="No remittance challan found")

    # Check permissions
    """if current_user.role not in [Role.HR, Role.ADMIN] and file.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to access this file")"""
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only download your own files",
        )

    if not Path(file.remittance_challan_path).exists():
        raise HTTPException(
            status_code=404, detail="Remittance file not found on server"
        )

    return FileResponse(
        file.remittance_challan_path,
        filename=f"remittance_challan_{file_id}.pdf",
        media_type="application/pdf",
    )


@app.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    year: int = Query(None, description="Filter by specific year"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Initialize base queries
    pf_query = db.query(ProcessedFilePF)
    esi_query = db.query(ProcessedFileESI)

    # Apply user-specific filters if not admin
    if current_user.role not in [Role.ADMIN]:
        pf_query = pf_query.filter(ProcessedFilePF.user_id == current_user.id)
        esi_query = esi_query.filter(ProcessedFileESI.user_id == current_user.id)

    # Apply year filter if provided
    if year:
        pf_query = pf_query.filter(extract("year", ProcessedFilePF.created_at) == year)
        esi_query = esi_query.filter(
            extract("year", ProcessedFileESI.created_at) == year
        )

    # Get counts for PF files
    pf_total = pf_query.count()
    pf_success = pf_query.filter(ProcessedFilePF.status == "success").count()
    pf_error = pf_query.filter(ProcessedFilePF.status == "error").count()

    # Get counts for ESI files
    esi_total = esi_query.count()
    esi_success = esi_query.filter(ProcessedFileESI.status == "success").count()
    esi_error = esi_query.filter(ProcessedFileESI.status == "error").count()

    # Combine totals
    total_files = pf_total + esi_total
    success_files = pf_success + esi_success
    error_files = pf_error + esi_error

    # Get recent files (only user's files unless admin)
    pf_recent = pf_query.order_by(ProcessedFilePF.created_at.desc()).limit(5).all()
    esi_recent = esi_query.order_by(ProcessedFileESI.created_at.desc()).limit(5).all()
    all_recent = sorted(
        pf_recent + esi_recent, key=lambda x: x.created_at, reverse=True
    )[:5]

    # Monthly data collection
    monthly_data = defaultdict(
        lambda: {
            "pf_total": 0,
            "pf_success": 0,
            "pf_error": 0,
            "esi_total": 0,
            "esi_success": 0,
            "esi_error": 0,
            "remittance_submitted": 0,
        }
    )

    # PF monthly stats (user-specific or all for admin)
    pf_monthly_query = db.query(
        extract("month", ProcessedFilePF.created_at).label("month"),
        func.count().label("total"),
        func.sum(case((ProcessedFilePF.status == "success", 1), else_=0)).label(
            "success"
        ),
        func.sum(case((ProcessedFilePF.status == "error", 1), else_=0)).label("error"),
        func.sum(
            case((ProcessedFilePF.remittance_submitted == True, 1), else_=0)
        ).label("remittance"),
    )

    if current_user.role not in [Role.ADMIN]:
        pf_monthly_query = pf_monthly_query.filter(
            ProcessedFilePF.user_id == current_user.id
        )

    pf_monthly = pf_monthly_query.group_by("month").all()

    for month in pf_monthly:
        monthly_data[month.month]["pf_total"] += month.total
        monthly_data[month.month]["pf_success"] += month.success
        monthly_data[month.month]["pf_error"] += month.error
        monthly_data[month.month]["remittance_submitted"] += month.remittance

    # ESI monthly stats (user-specific or all for admin)
    esi_monthly_query = db.query(
        extract("month", ProcessedFileESI.created_at).label("month"),
        func.count().label("total"),
        func.sum(case((ProcessedFileESI.status == "success", 1), else_=0)).label(
            "success"
        ),
        func.sum(case((ProcessedFileESI.status == "error", 1), else_=0)).label("error"),
    )

    if current_user.role not in [Role.ADMIN]:
        esi_monthly_query = esi_monthly_query.filter(
            ProcessedFileESI.user_id == current_user.id
        )

    esi_monthly = esi_monthly_query.group_by("month").all()

    for month in esi_monthly:
        monthly_data[month.month]["esi_total"] += month.total
        monthly_data[month.month]["esi_success"] += month.success
        monthly_data[month.month]["esi_error"] += month.error

    # Format monthly data for response
    formatted_monthly = {
        "labels": [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ],
        "datasets": {
            "pf_total": [monthly_data[m]["pf_total"] for m in range(1, 13)],
            "pf_success": [monthly_data[m]["pf_success"] for m in range(1, 13)],
            "pf_error": [monthly_data[m]["pf_error"] for m in range(1, 13)],
            "esi_total": [monthly_data[m]["esi_total"] for m in range(1, 13)],
            "esi_success": [monthly_data[m]["esi_success"] for m in range(1, 13)],
            "esi_error": [monthly_data[m]["esi_error"] for m in range(1, 13)],
            "remittance_submitted": [
                monthly_data[m]["remittance_submitted"] for m in range(1, 13)
            ],
        },
    }

    # Remittance statistics (user-specific or all for admin)
    remittance_query = db.query(ProcessedFilePF)
    if current_user.role not in [Role.ADMIN]:
        remittance_query = remittance_query.filter(
            ProcessedFilePF.user_id == current_user.id
        )

    remittance_stats = {
        "total_submitted": remittance_query.filter(
            ProcessedFilePF.remittance_submitted == True
        ).count(),
        "pending": pf_success
        - remittance_query.filter(ProcessedFilePF.remittance_submitted == True).count(),
        "timely_submissions": remittance_query.filter(
            ProcessedFilePF.remittance_submitted == True,
            ProcessedFilePF.remittance_date
            <= ProcessedFilePF.created_at + timedelta(days=7),
        ).count(),
    }

    # User activity (only for admins)
    user_activity = {}
    if current_user.role == Role.ADMIN:
        active_users = (
            db.query(
                UserModel.username,
                func.count(ProcessedFilePF.id).label("pf_files"),
                func.count(ProcessedFileESI.id).label("esi_files"),
            )
            .outerjoin(ProcessedFilePF, UserModel.id == ProcessedFilePF.user_id)
            .outerjoin(ProcessedFileESI, UserModel.id == ProcessedFileESI.user_id)
            .group_by(UserModel.username)
            .order_by(func.count(ProcessedFilePF.id).desc())
            .limit(5)
            .all()
        )

        user_activity = {
            "top_users": [
                {
                    "username": u.username,
                    "pf_files": u.pf_files,
                    "esi_files": u.esi_files,
                }
                for u in active_users
            ],
            "total_users": db.query(UserModel).count(),
        }

    # Remittance delays (user-specific or all for admin)
    remittance_delays_pf_query = db.query(
        func.cast(
            func.julianday(ProcessedFilePF.remittance_date)
            - func.julianday(ProcessedFilePF.created_at),
            Integer,
        ).label("delay_days"),
        func.count().label("count"),
    ).filter(
        ProcessedFilePF.remittance_submitted == True,
        ProcessedFilePF.remittance_date.isnot(None),
    )

    if current_user.role not in [Role.ADMIN]:
        remittance_delays_pf_query = remittance_delays_pf_query.filter(
            ProcessedFilePF.user_id == current_user.id
        )

    remittance_delays_pf = remittance_delays_pf_query.group_by("delay_days").all()

    remittance_delays_esi_query = db.query(
        func.cast(
            func.julianday(ProcessedFileESI.remittance_date)
            - func.julianday(ProcessedFileESI.created_at),
            Integer,
        ).label("delay_days"),
        func.count().label("count"),
    ).filter(
        ProcessedFileESI.remittance_submitted == True,
        ProcessedFileESI.remittance_date.isnot(None),
    )

    if current_user.role not in [Role.ADMIN]:
        remittance_delays_esi_query = remittance_delays_esi_query.filter(
            ProcessedFileESI.user_id == current_user.id
        )

    remittance_delays_esi = remittance_delays_esi_query.group_by("delay_days").all()

    # Combine delay data
    delay_data = []
    for d in remittance_delays_pf:
        delay_data.append({"days": int(d.delay_days), "count": d.count, "type": "PF"})

    for d in remittance_delays_esi:
        delay_data.append({"days": int(d.delay_days), "count": d.count, "type": "ESI"})

    return DashboardStats(
        total_files=total_files or 0,
        success_files=success_files or 0,
        error_files=error_files or 0,
        recent_files=[ProcessedFileResponse.from_orm(f) for f in all_recent] or [],
        pf_files=pf_total or 0,
        esi_files=esi_total or 0,
        pf_success=pf_success or 0,
        pf_error=pf_error or 0,
        esi_success=esi_success or 0,
        esi_error=esi_error or 0,
        monthly_stats=formatted_monthly,
        remittance_stats=remittance_stats,
        user_activity=user_activity,
        remittance_delays=delay_data,
    )


"""@app.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    year:int =Query(None,description="Filter by specific year"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Base queries for PF files
    pf_query = db.query(ProcessedFilePF)
    # Base queries for ESI files
    esi_query = db.query(ProcessedFileESI)
    
    # Apply user filter if not admin/HR
    if current_user.role not in [Role.HR, Role.ADMIN]:
        pf_query = pf_query.filter(ProcessedFilePF.user_id == current_user.id)
        esi_query = esi_query.filter(ProcessedFileESI.user_id == current_user.id)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        pf_query = pf_query.filter(ProcessedFilePF.user_id == current_user.id)
        esi_query = esi_query.filter(ProcessedFileESI.user_id == current_user.id)
    
    # Apply year filter if provided
    if year:
        pf_query = pf_query.filter(extract('year', ProcessedFilePF.created_at) == year)
        esi_query = esi_query.filter(extract('year', ProcessedFileESI.created_at) == year)
    # Get counts for PF files
    pf_total = pf_query.count()
    pf_success = pf_query.filter(ProcessedFilePF.status == "success").count()
    pf_error = pf_query.filter(ProcessedFilePF.status == "error").count()
    
    # Get counts for ESI files
    esi_total = esi_query.count()
    esi_success = esi_query.filter(ProcessedFileESI.status == "success").count()
    esi_error = esi_query.filter(ProcessedFileESI.status == "error").count()
    
    # Combine totals
    total_files = pf_total + esi_total
    success_files = pf_success + esi_success
    error_files = pf_error + esi_error
    
    # Get recent files from both tables
    pf_recent = pf_query.order_by(ProcessedFilePF.created_at.desc()).limit(5).all()
    esi_recent = esi_query.order_by(ProcessedFileESI.created_at.desc()).limit(5).all()
    all_recent = sorted(pf_recent + esi_recent, key=lambda x: x.created_at, reverse=True)[:5]
    monthly_data = defaultdict(lambda: {
        'pf_total': 0,
        'pf_success': 0,
        'pf_error': 0,
        'esi_total': 0,
        'esi_success': 0,
        'esi_error': 0,
        'remittance_submitted': 0
    })
    pf_monthly = db.query(
        extract('month', ProcessedFilePF.created_at).label('month'),
        func.count().label('total'),
        func.sum(case((ProcessedFilePF.status == "success", 1), else_=0)).label('success'),
        func.sum(case((ProcessedFilePF.status == "error", 1), else_=0)).label('error'),
        func.sum(case((ProcessedFilePF.remittance_submitted == True, 1), else_=0)).label('remittance')
    ).group_by('month').all()
    
    for month in pf_monthly:
        monthly_data[month.month]['pf_total'] += month.total
        monthly_data[month.month]['pf_success'] += month.success
        monthly_data[month.month]['pf_error'] += month.error
        monthly_data[month.month]['remittance_submitted'] += month.remittance
    
    # Get monthly breakdown for ESI files
    esi_monthly = db.query(
        extract('month', ProcessedFileESI.created_at).label('month'),
        func.count().label('total'),
        func.sum(case((ProcessedFileESI.status == "success", 1), else_=0)).label('success'),
        func.sum(case((ProcessedFileESI.status == "error", 1), else_=0)).label('error')
    ).group_by('month').all()
    
    for month in esi_monthly:
        monthly_data[month.month]['esi_total'] += month.total
        monthly_data[month.month]['esi_success'] += month.success
        monthly_data[month.month]['esi_error'] += month.error
    
    # Format monthly data for response
    formatted_monthly = {
        'labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        'datasets': {
            'pf_total': [monthly_data[m]['pf_total'] for m in range(1, 13)],
            'pf_success': [monthly_data[m]['pf_success'] for m in range(1, 13)],
            'pf_error': [monthly_data[m]['pf_error'] for m in range(1, 13)],
            'esi_total': [monthly_data[m]['esi_total'] for m in range(1, 13)],
            'esi_success': [monthly_data[m]['esi_success'] for m in range(1, 13)],
            'esi_error': [monthly_data[m]['esi_error'] for m in range(1, 13)],
            'remittance_submitted': [monthly_data[m]['remittance_submitted'] for m in range(1, 13)]
        }
    }
    
    # Remittance statistics
    remittance_stats = {
        'total_submitted': db.query(ProcessedFilePF)
                            .filter(ProcessedFilePF.remittance_submitted == True)
                            .count(),
        'pending': pf_success - db.query(ProcessedFilePF)
                                .filter(ProcessedFilePF.remittance_submitted == True)
                                .count(),
        'timely_submissions': db.query(ProcessedFilePF)
                              .filter(
                                  ProcessedFilePF.remittance_submitted == True,
                                  ProcessedFilePF.remittance_date <= ProcessedFilePF.created_at + timedelta(days=7)
                              ).count()
    }
    
    # User activity (only for admins/HR)
    user_activity = {}
    if current_user.role in [Role.HR, Role.ADMIN]:
        active_users = db.query(
            UserModel.username,
            func.count(ProcessedFilePF.id).label('pf_files'),
            func.count(ProcessedFileESI.id).label('esi_files')
        ).outerjoin(ProcessedFilePF, UserModel.id == ProcessedFilePF.user_id
        ).outerjoin(ProcessedFileESI, UserModel.id == ProcessedFileESI.user_id
        ).group_by(UserModel.username).order_by(func.count(ProcessedFilePF.id).desc()).limit(5).all()
        
        user_activity = {
            'top_users': [{'username': u.username, 'pf_files': u.pf_files, 'esi_files': u.esi_files} 
                         for u in active_users],
            'total_users': db.query(UserModel).count()
        }
    remittance_delays_pf = db.query(
        func.cast(
            func.julianday(ProcessedFilePF.remittance_date) - func.julianday(ProcessedFilePF.created_at),
            Integer
        ).label('delay_days'),
        func.count().label('count')
    ).filter(
        ProcessedFilePF.remittance_submitted == True,
        ProcessedFilePF.remittance_date.isnot(None)
    ).group_by('delay_days').all()

    remittance_delays_esi = db.query(
        func.cast(
            func.julianday(ProcessedFileESI.remittance_date) - func.julianday(ProcessedFileESI.created_at),
            Integer
        ).label('delay_days'),
        func.count().label('count')
    ).filter(
        ProcessedFileESI.remittance_submitted == True,
        ProcessedFileESI.remittance_date.isnot(None)
    ).group_by('delay_days').all()

    # Combine results with type indicators
    delay_data = []
    for d in remittance_delays_pf:
        delay_data.append({
            'days': int(d.delay_days),
            'count': d.count,
            'type': 'PF'
        })
    
    for d in remittance_delays_esi:
        delay_data.append({
            'days': int(d.delay_days),
            'count': d.count,
            'type': 'ESI'
        })
    return DashboardStats(
        total_files=total_files or 0,
        success_files=success_files or 0,
        error_files=error_files or 0,
        recent_files=[ProcessedFileResponse.from_orm(f) for f in all_recent] or [],
        pf_files=pf_total,
        esi_files=esi_total,
        pf_success=pf_success,
        pf_error=pf_error,
        esi_success=esi_success,
        esi_error=esi_error,
        monthly_stats=formatted_monthly,
        remittance_stats=remittance_stats,
        user_activity=user_activity,
        remittance_delays  = delay_data)"""


# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)


# Call the function to create tables
create_db_tables()
