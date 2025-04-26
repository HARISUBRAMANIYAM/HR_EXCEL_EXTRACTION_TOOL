import asyncio
import concurrent
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Response,
    UploadFile,
    File,
    Form,
    Query,
    logger,
)
from fastapi.encoders import jsonable_encoder
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, List
from datetime import datetime, timedelta, time
import os
from jose import JWTError, jwt
from sqlalchemy import ForeignKey, case, extract
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session
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

from collections import defaultdict
from datetime import datetime
from fastapi import Query, Depends
from sqlalchemy import extract, func, case, and_
from sqlalchemy import text
from sqlalchemy.orm import Session
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
    user = (
        db.query(UserModel).filter(UserModel.username == password_data.username).first()
    )
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
    user.hashed_password = hash_password(password_data.new_password)
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


@app.post("/refresh_token")
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid refresh Token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh Token")
    new_access_token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=30)
    )
    return {"acesssToken": new_access_token, "token_type": "bearer"}


# ********************************************************************************************#
@app.post("/process_folder_pf_new", response_model=FileProcessResult)
async def process_folder(
    files: List[UploadFile] = File(
        ..., description="List of Excel files from the folder"
    ),
    folder_name: str = Form(..., min_length=1, max_length=500),
    current_user: UserModel = Depends(require_hr_or_admin),
    upload_month: str = Form(..., description="Month in MM-YYYY format"),
    db: Session = Depends(get_db),
):
    try:
        # Parse and validate the month input
        upload_date_obj = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = upload_date_obj.replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # Filter only Excel files
    excel_files = [
        file for file in files if file.filename.lower().endswith((".xls", ".xlsx"))
    ]
    if not excel_files:
        raise HTTPException(
            status_code=400, detail="No Excel files found in the upload"
        )

    # Create output directory
    timestamp_folder = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("processed_pf") / upload_month / timestamp_folder
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filenames
    processing_id = uuid.uuid4().hex[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    excel_filename = f"{upload_month.replace('-', '_')}_{timestamp}.xlsx"
    text_filename = f"{upload_month.replace('-', '_')}_{timestamp}.txt"
    excel_file_path = output_dir / excel_filename
    text_file_path = output_dir / text_filename

    # Initialize combined DataFrame
    combined_df = pd.DataFrame()
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."

    # Process each file and combine results
    for excel_file in excel_files:
        try:
            # Read Excel file
            if excel_file.filename.lower().endswith(".xlsx"):
                df = pd.read_excel(excel_file.file, dtype={"UAN No": str})
            else:
                df = pd.read_excel(
                    excel_file.file, engine="xlrd", dtype={"UAN No": str}
                )

            if df.empty:
                raise ValueError("Excel file is empty")

            # Check for required columns
            required_columns = {
                "UAN No": ["UAN No"],
                "Employee Name": ["Employee Name"],
                "Gross Wages": ["Total Salary", "Gross Salary"],
                "EPF Wages": ["PF Gross", "EPF Gross"],
                "LOP Days": ["LOP", "LOP Days"],
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
                raise ValueError(
                    f"Missing required columns: {', '.join(missing_columns)}"
                )

            # Process data
            uan_no = df[column_mapping["UAN No"]].astype(str).str.replace("-", "")
            member_name = df[column_mapping["Employee Name"]]
            gross_wages = (
                df[column_mapping["Gross Wages"]].fillna(0).round().astype(int)
            )
            epf_wages = df[column_mapping["EPF Wages"]].fillna(0).round().astype(int)
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
            eps_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
            edli_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
            epf_contrib_remitted = (epf_wages * 0.12).round().astype(int)
            eps_contrib_remitted = (eps_wages * 0.0833).round().astype(int)
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

            combined_df = pd.concat([combined_df, output_df], ignore_index=True)
            processed_files.append(
                {
                    "filename": excel_file.filename,
                    "status": "success",
                    "message": "Processed successfully",
                }
            )

        except Exception as e:
            processed_files.append(
                {
                    "filename": excel_file.filename,
                    "status": "error",
                    "message": f"Error processing file: {str(e)}",
                }
            )
            overall_status = "error"
            overall_message = "Some files had errors during processing."

    # Save combined output only if we have successful processed data
    if not combined_df.empty:
        try:
            # Save Excel file
            combined_df.to_excel(excel_file_path, index=False)

            # Save text file
            output_lines = [
                "#~#".join(map(str, row)) for row in combined_df.values.tolist()
            ]
            header_line = "#~#".join(combined_df.columns)
            output_lines.insert(0, header_line)

            with open(text_file_path, "w") as f:
                f.write("\n".join(output_lines))
        except Exception as e:
            overall_status = "error"
            overall_message = f"Error saving combined files: {str(e)}"

    # Create database record
    db_record = ProcessedFilePF(
        user_id=current_user.id,
        filename=excel_filename,
        filepath=f"{str(excel_file_path)},{str(text_file_path)}",
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
        upload_date=first_day_of_month,
    )

    try:
        db.add(db_record)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error saving record to database: {str(e)}"
        )

    return FileProcessResult(
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
        file_path=str(excel_file_path),
        processed_files=processed_files,
        total_files=len(excel_files),
        successful_files=len([f for f in processed_files if f["status"] == "success"]),
    )


@app.get("/processed_files_pf", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    upload_month: str = Query(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(get_current_user),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    db: Session = Depends(get_db),
):
    try:
        # Parse the month input
        month_date = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = month_date.replace(day=1)
        last_day_of_month = (first_day_of_month + timedelta(days=32)).replace(
            day=1
        ) - timedelta(days=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    # Base query for files within the month
    query = db.query(ProcessedFilePF).filter(
        ProcessedFilePF.upload_date >= first_day_of_month,
        ProcessedFilePF.upload_date <= last_day_of_month,
    )

    # Apply user filtering
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFilePF.user_id == user_id)
    else:
        query = query.filter(ProcessedFilePF.user_id == current_user.id)

    # Get all files for the given month and user(s)
    files = query.order_by(ProcessedFilePF.created_at.desc()).all()

    # Group files by their timestamp folder (extracted from filepath)
    processed_results = []
    seen_folders = set()

    for file in files:
        if file.status == "success":
            try:
                # Extract the timestamp folder from the filepath
                filepaths = file.filepath.split(",")
                if len(filepaths) == 2:
                    excel_path = Path(filepaths[0])
                    # The parent folder is the timestamp folder
                    timestamp_folder = excel_path.parent.name

                    # Only process each timestamp folder once
                    if timestamp_folder in seen_folders:
                        continue

                    seen_folders.add(timestamp_folder)

                    # Verify both files exist
                    text_path = Path(filepaths[1])
                    if excel_path.exists() and text_path.exists():
                        processed_results.append(file)
                    else:
                        # Update DB record if files are missing
                        file.status = "error"
                        file.message = "Output files not found on server"
                        db.add(file)
                else:
                    file.status = "error"
                    file.message = "Invalid file path format in database"
                    db.add(file)
            except Exception:
                # If any error occurs while processing the filepath, mark as error
                file.status = "error"
                file.message = "Error processing file path"
                db.add(file)
                processed_results.append(file)
        else:
            processed_results.append(file)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Log the error but continue with the response

    # For non-admin users or when specific user_id is provided, return all results
    if current_user.role != Role.ADMIN or user_id is not None:
        return [ProcessedFileResponse.from_orm(file) for file in processed_results]

    # For admin viewing all users without specific user_id filter,
    # return only the most recent processing for each user
    user_latest = {}
    for file in processed_results:
        if (
            file.user_id not in user_latest
            or file.created_at > user_latest[file.user_id].created_at
        ):
            user_latest[file.user_id] = file

    return [ProcessedFileResponse.from_orm(file) for file in user_latest.values()]


# *****************************************************************************************#
@app.get("/processed_files_pf_new", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    upload_month: str = Query(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(get_current_user),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    db: Session = Depends(get_db),
):
    try:
        # Parse the month input
        month_date = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = month_date.replace(day=1)
        last_day_of_month = (first_day_of_month + timedelta(days=32)).replace(
            day=1
        ) - timedelta(days=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    # Base query for files within the month
    query = db.query(ProcessedFilePF).filter(
        ProcessedFilePF.upload_date >= first_day_of_month,
        ProcessedFilePF.upload_date <= last_day_of_month,
        ProcessedFilePF.filename.like(f"%{upload_month.replace('-', '_')}%"),
    )

    # Apply user filtering
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFilePF.user_id == user_id)
    else:
        query = query.filter(ProcessedFilePF.user_id == current_user.id)

    # Get the most recent files based on user role
    if current_user.role == Role.ADMIN and user_id is None:
        # For admin viewing all users, get most recent file per user
        subquery = (
            db.query(
                ProcessedFilePF.user_id,
                func.max(ProcessedFilePF.created_at).label("max_created_at"),
            )
            .filter(
                ProcessedFilePF.upload_date >= first_day_of_month,
                ProcessedFilePF.upload_date <= last_day_of_month,
                ProcessedFilePF.filename.like(f"%{upload_month.replace('-', '_')}%"),
            )
            .group_by(ProcessedFilePF.user_id)
            .subquery()
        )

        query = query.join(
            subquery,
            and_(
                ProcessedFilePF.user_id == subquery.c.user_id,
                ProcessedFilePF.created_at == subquery.c.max_created_at,
            ),
        )
    else:
        # For single user, get their most recent file
        query = query.order_by(ProcessedFilePF.created_at.desc()).limit(1)

    files = query.all()

    # Verify file existence and enrich response with additional data
    valid_files = []
    for file in files:
        if file.status == "success":
            filepaths = file.filepath.split(",")
            if len(filepaths) == 2:
                excel_path = Path(filepaths[0])
                text_path = Path(filepaths[1])

                if excel_path.exists() and text_path.exists():
                    # Add additional information from the new fields
                    file_details = {
                        "id": file.id,
                        "filename": file.filename,
                        "status": file.status,
                        "message": file.message,
                        "upload_month": file.upload_month,
                        "created_at": file.created_at,
                        "source_folder": file.source_folder,
                        "processed_files_count": file.processed_files_count,
                        "success_files_count": file.success_files_count,
                        "excel_file_url": f"/download/pf/{file.id}/excel",
                        "text_file_url": f"/download/pf/{file.id}/text",
                    }
                    valid_files.append(file_details)
                else:
                    # Update DB record if files are missing
                    file.status = "error"
                    file.message = "Output files not found on server"
                    db.add(file)
            else:
                file.status = "error"
                file.message = "Invalid file path format in database"
                db.add(file)
        else:
            # Include failed processing attempts with their error details
            valid_files.append(
                {
                    "id": file.id,
                    "filename": file.filename,
                    "status": file.status,
                    "message": file.message,
                    "upload_month": file.upload_month,
                    "created_at": file.created_at,
                    "source_folder": file.source_folder,
                    "processed_files_count": file.processed_files_count,
                    "success_files_count": file.success_files_count,
                }
            )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Log the error but continue with the response
        logger.error(f"Error committing database changes: {str(e)}")

    return valid_files


# *************************************************************************
@app.post("/processed_files_pf/{file_id}/submit_remittance_new")
async def submit_remittance(
    file_id: int,
    remittance_date: str = Form(
        ..., description="Enter the date for the Remittance DD-MM-YYYY formate"
    ),
    remittance_amount: float = Form(..., description="Total remittance amount"),
    remittance_file: UploadFile = File(...),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """
    Submit remittance documentation for a processed PF file.
    Automatically uses the file's upload month for organization.
    """
    # Validate file is PDF
    if not remittance_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Validate remittance amount
    if remittance_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Remittance amount must be positive"
        )

    # Get the file record
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if current_user.role not in [Role.HR, Role.ADMIN]:
        raise HTTPException(
            status_code=403, detail="Only HR or Admin can submit remittances"
        )

    # Use the file's original upload month for organization
    if not file.upload_month:
        raise HTTPException(
            status_code=400, detail="File missing upload month information"
        )

    # Create remittance directory using the file's month
    remittance_dir = Path("remittance_challans") / file.upload_month  # MM-YYYY format
    remittance_dir.mkdir(parents=True, exist_ok=True)

    # Generate standardized filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    new_filename = (
        f"PF_Remittance_{file.upload_month.replace('-', '_')}_{file_id}_{timestamp}.pdf"
    )
    file_path = remittance_dir / new_filename

    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(remittance_file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save remittance file: {str(e)}"
        )

    # Update database record
    try:
        file.remittance_submitted = True
        file.remittance_month = file.upload_month  # Use same month as original file
        file.remittance_date = remittance_date  # Use same date as original file
        file.remittance_amount = remittance_amount
        file.remittance_challan_path = str(file_path)
        file.remittance_submitted_at = datetime.now()
        file.remittance_submitted_by = current_user.id
        db.commit()
    except Exception as e:
        # Clean up the saved file if database update fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500, detail=f"Failed to update database: {str(e)}"
        )

    return {
        "status": "success",
        "message": "Remittance submitted successfully",
        "details": {
            "file_id": file_id,
            "remittance_month": file.upload_month,
            "remittnace_date": remittance_date,
            "remittance_amount": remittance_amount,
            "challan_path": str(file_path),
            "submitted_at": datetime.now().isoformat(),
        },
    }


# *************************************************************************************#


# ********************************************************************
@app.get("/processed_files_pf/{file_id}/remittance_challan_new")
async def download_remittance_challan(
    file_id: int,
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """
    Download a remittance challan PDF for a processed PF file.
    Returns the PDF file with proper filename formatting including month/year.
    """
    # Get the file record
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if remittance exists
    if not file.remittance_submitted or not file.remittance_challan_path:
        raise HTTPException(
            status_code=404, detail="No remittance challan found for this file"
        )

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to access this remittance challan",
        )

    # Verify file exists on server
    challan_path = Path(file.remittance_challan_path)
    if not challan_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Remittance file not found on server. Please contact administrator.",
        )

    # Generate a formatted filename using upload_month from the file record
    filename = f"PF_Remittance_{file.upload_month.replace('-', '_')}_{file_id}.pdf"

    return FileResponse(
        str(challan_path),
        filename=filename,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Remittance-Month": file.upload_month or "",
            "X-Remittance-Amount": (
                str(file.remittance_amount) if file.remittance_amount else "0"
            ),
        },
    )


# ********************************************************
@app.get("/processed_files_pf/{file_id}/download_new")
async def download_pf_file(
    file_id: int,
    file_type: str = Query(
        None, regex="^(txt|xlsx)$", description="File type to download (txt or xlsx)"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download processed PF files (Excel or text format) with proper month/year organization.

    Parameters:
    - file_id: ID of the processed file
    - file_type: 'txt' for text file or 'xlsx' for Excel file (defaults to Excel)
    """
    # Get the file record from the database
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only download your own files",
        )

    if file.status != "success":
        raise HTTPException(
            status_code=400,
            detail="File cannot be downloaded as processing was not successful",
        )

    # Parse file paths (stored as "excel_path,txt_path" in database)
    try:
        excel_path, text_path = file.filepath.split(",")
    except ValueError:
        raise HTTPException(
            status_code=500, detail="Invalid file path format in database"
        )

    # Determine which file to serve based on file_type parameter
    if file_type and file_type.lower() == "txt":
        file_path = Path(text_path)
        media_type = "text/plain"
        filename = f"PF_{file.upload_month.replace('-', '_')}_{file_id}.txt"
    else:
        # Default to Excel download
        file_path = Path(excel_path)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"PF_{file.upload_month.replace('-', '_')}_{file_id}.xlsx"

    # Verify file exists
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Requested file not found on server: {file_path.name}",
        )

    # Set content disposition with proper filename
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "X-File-Month": file.upload_month or "",
    }

    return FileResponse(
        path=file_path, filename=filename, media_type=media_type, headers=headers
    )


# *************************************************************************
@app.get("/processed_files_pf/batch_download_new")
async def download_multiple_pf_files(
    file_ids: str = Query(..., description="Comma-separated list of file IDs"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Download multiple PF files as a zip archive, organized by month/year (MM-YYYY) folders.
    Includes both Excel and text versions of each file when available.
    """
    try:
        # Convert comma-separated string to list of integers
        file_ids_list = list(
            {int(id.strip()) for id in file_ids.split(",") if id.strip()}
        )  # Remove duplicates
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file IDs format")

    # Get all requested files from database
    files = (
        db.query(ProcessedFilePF).filter(ProcessedFilePF.id.in_(file_ids_list)).all()
    )

    if not files:
        raise HTTPException(
            status_code=404, detail="No files found with the provided IDs"
        )

    # Verify permissions and file status
    valid_files = []
    for file in files:
        if current_user.role == Role.USER and file.user_id != current_user.id:
            continue  # Skip unauthorized files rather than failing the entire request

        if file.status != "success":
            continue  # Skip failed files

        try:
            # Verify file paths exist
            excel_path, text_path = file.filepath.split(",")
            if not Path(excel_path).exists() or not Path(text_path).exists():
                continue
        except (ValueError, AttributeError):
            continue  # Skip files with invalid paths

        valid_files.append(file)

    if not valid_files:
        raise HTTPException(
            status_code=404, detail="No valid files available for download"
        )

    # Create in-memory zip file
    zip_buffer = BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    files_added = 0

    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file in valid_files:
            try:
                excel_path, text_path = file.filepath.split(",")
                month_folder = file.upload_month or "unknown_month"

                # Create standardized filenames
                base_filename = f"PF_{month_folder.replace('-', '_')}_{file.id}"

                # Add files to zip with organized structure
                zip_dir = f"PF_Files/{month_folder}"

                # Add Excel file
                zip_file.write(excel_path, f"{zip_dir}/{base_filename}.xlsx")
                files_added += 1

                # Add text file
                zip_file.write(text_path, f"{zip_dir}/{base_filename}.txt")
                files_added += 1

            except Exception as e:
                continue  # Skip files that cause errors

    if files_added == 0:
        raise HTTPException(status_code=500, detail="Failed to package any files")

    # Verify zip integrity
    zip_buffer.seek(0)
    try:
        with zipfile.ZipFile(zip_buffer, "r") as test_zip:
            if test_zip.testzip() is not None:
                raise HTTPException(status_code=500, detail="Error creating zip file")
    except:
        raise HTTPException(status_code=500, detail="Error creating zip file")

    # Return the zip file
    zip_buffer.seek(0)

    def cleanup():
        zip_buffer.close()

    background_tasks.add_task(cleanup)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=pf_files_{timestamp}.zip",
            "X-Files-Count": str(files_added),
            "X-Zip-Integrity": "valid",
        },
        background=background_tasks,
    )


# ***************************ESI************************************#
@app.post("/process_folder_esi", response_model=FileProcessResult)
async def process_esi_file(
    folder_path: str = Form(...),
    upload_month: str = Form(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    try:
        # Validate and parse the upload month
        upload_date_obj = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = upload_date_obj.replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    folder = Path(folder_path)
    if not folder_path.strip():
        raise HTTPException(status_code=422, detail="Folder path cannot be empty")
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFileESI(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
            upload_month=upload_month,
            upload_date=first_day_of_month,
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
            upload_month=upload_month,
            upload_date=first_day_of_month,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)

    # Prepare single output directory
    output_dir = Path("processed_esi") / upload_month
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filenames for combined output
    processing_id = uuid.uuid4().hex[:8]
    excel_filename = f"{upload_month.replace('-', '_')}_.xlsx"
    text_filename = f"{upload_month.replace('-', '_')}_.txt"

    excel_file_path = output_dir / excel_filename
    text_file_path = output_dir / text_filename

    # Initialize combined DataFrame
    combined_df = pd.DataFrame()
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."

    # Process each file and combine results
    for excel_file in excel_files:
        try:
            # Read Excel file
            if excel_file.suffix == ".xlsx":
                df = pd.read_excel(excel_file, dtype={"ESI N0": str})
            else:
                df = pd.read_excel(excel_file, engine="xlrd", dtype={"ESI N0": str})

            if df.empty:
                raise ValueError("Excel file is empty")

            # Check for required columns
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
                raise ValueError(
                    f"Missing required columns: {', '.join(missing_columns)}"
                )

            # Filter valid rows
            esi_column = df[column_mapping["ESI No"]]
            esi_column_gross = df[column_mapping["ESI Gross"]]

            valid_esi_mask = ~(
                (esi_column == 0)
                | (esi_column == "0")
                | (esi_column == "0.0")
                | (esi_column.isna())
                | (esi_column.isnull())
                | (esi_column == "")
            )

            valid_esi_gross_mask = ~(
                (esi_column_gross == 0)
                | (esi_column_gross.isna())
                | (esi_column_gross.isnull())
            )

            valid_rows_mask = valid_esi_mask & valid_esi_gross_mask
            df = df[valid_rows_mask]

            # Process data
            esi_no = df[column_mapping["ESI No"]].astype(str).str.replace("-", "")
            member_name = df[column_mapping["Employee Name"]]
            esi_gross = df[column_mapping["ESI Gross"]].fillna(0).round().astype(int)
            worked_days_raw = df[column_mapping["Worked Days"]]

            def custom_round(x):
                if pd.isna(x):
                    return 0
                decimal_part = x - int(x)
                if decimal_part >= 0.5:
                    return math.ceil(x)
                else:
                    return math.floor(x)

            worked_days = worked_days_raw.apply(custom_round)

            output_df = pd.DataFrame(
                {
                    "ESI No": esi_no,
                    "MEMBER NAME": member_name,
                    "ESI GROSS": esi_gross,
                    "WORKED DAYS": worked_days,
                }
            )

            combined_df = pd.concat([combined_df, output_df], ignore_index=True)
            processed_files.append(
                {
                    "filename": excel_file.name,
                    "status": "success",
                    "message": "Processed successfully",
                }
            )

        except Exception as e:
            error_message = f"Error processing file {excel_file.name}: {str(e)}"
            processed_files.append(
                {
                    "filename": excel_file.name,
                    "status": "error",
                    "message": error_message,
                }
            )
            overall_status = "error"
            overall_message = "Some files had errors during processing."

    # Save combined output only if we have successful processed data
    if not combined_df.empty:
        try:
            # Save Excel file
            combined_df.to_excel(excel_file_path, index=False)

            # Save text file
            output_lines = [
                "#~#".join(map(str, row)) for row in combined_df.values.tolist()
            ]
            header_line = "#~#".join(combined_df.columns)
            output_lines.insert(0, header_line)

            with open(text_file_path, "w") as f:
                f.write("\n".join(output_lines))
        except Exception as e:
            overall_status = "error"
            overall_message = f"Error saving combined files: {str(e)}"

    # Create a single database record for the entire processing
    db_record = ProcessedFileESI(
        user_id=current_user.id,
        filename=excel_filename,
        filepath=f"{str(excel_file_path)},{str(text_file_path)}",
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
        upload_date=first_day_of_month,  # Store individual file statuses
    )

    try:
        db.add(db_record)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error saving record to database: {str(e)}"
        )

    return FileProcessResult(
        file_path=folder_path,
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
    )


# *******************************************************************************
@app.post("/process_folder_esi_new", response_model=FileProcessResult)
async def process_esi_file(
    files: List[UploadFile] = File(..., description="List of Excel files from the folder"),
    folder_name: str = Form(..., min_length=1, max_length=500),
    upload_month: str = Form(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    try:
        # Validate and parse the upload month
        upload_date_obj = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = upload_date_obj.replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # Filter only Excel files
    excel_files = [file for file in files if file.filename.lower().endswith(('.xls', '.xlsx'))]
    if not excel_files:
        raise HTTPException(status_code=400, detail="No Excel files found in the upload")

    # Prepare output directory
    timestamp_folder = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("processed_esi") / upload_month / timestamp_folder
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filenames
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    excel_filename = f"{upload_month.replace('-', '_')}_{timestamp}.xlsx"
    text_filename = f"{upload_month.replace('-', '_')}_{timestamp}.txt"
    excel_file_path = output_dir / excel_filename
    text_file_path = output_dir / text_filename

    # Initialize combined DataFrame
    combined_df = pd.DataFrame()
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."

    # Process each file and combine results
    for excel_file in excel_files:
        try:
            # Read Excel file
            if excel_file.filename.lower().endswith('.xlsx'):
                df = pd.read_excel(excel_file.file, dtype={"ESI N0": str})
            else:
                df = pd.read_excel(excel_file.file, engine="xlrd", dtype={"ESI N0": str})

            if df.empty:
                raise ValueError("Excel file is empty")

            # Check for required columns
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
                raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

            # Filter valid rows
            esi_column = df[column_mapping["ESI No"]]
            esi_column_gross = df[column_mapping["ESI Gross"]]

            valid_esi_mask = ~(
                (esi_column == 0)
                | (esi_column == "0")
                | (esi_column == "0.0")
                | (esi_column.isna())
                | (esi_column.isnull())
                | (esi_column == "")
            )

            valid_esi_gross_mask = ~(
                (esi_column_gross == 0)
                | (esi_column_gross.isna())
                | (esi_column_gross.isnull())
            )

            valid_rows_mask = valid_esi_mask & valid_esi_gross_mask
            df = df[valid_rows_mask]

            # Process data
            esi_no = df[column_mapping["ESI No"]].astype(str).str.replace("-", "")
            member_name = df[column_mapping["Employee Name"]]
            esi_gross = df[column_mapping["ESI Gross"]].fillna(0).round().astype(int)
            worked_days_raw = df[column_mapping["Worked Days"]]

            def custom_round(x):
                if pd.isna(x):
                    return 0
                decimal_part = x - int(x)
                if decimal_part >= 0.5:
                    return math.ceil(x)
                else:
                    return math.floor(x)

            worked_days = worked_days_raw.apply(custom_round)

            output_df = pd.DataFrame({
                "ESI No": esi_no,
                "MEMBER NAME": member_name,
                "ESI GROSS": esi_gross,
                "WORKED DAYS": worked_days,
            })

            combined_df = pd.concat([combined_df, output_df], ignore_index=True)
            processed_files.append({
                "filename": excel_file.filename,
                "status": "success",
                "message": "Processed successfully",
            })

        except Exception as e:
            processed_files.append({
                "filename": excel_file.filename,
                "status": "error",
                "message": f"Error processing file: {str(e)}",
            })
            overall_status = "error"
            overall_message = "Some files had errors during processing."

    # Save combined output only if we have successful processed data
    if not combined_df.empty:
        try:
            # Save Excel file
            combined_df.to_excel(excel_file_path, index=False)

            # Save text file
            output_lines = ["#~#".join(map(str, row)) for row in combined_df.values.tolist()]
            header_line = "#~#".join(combined_df.columns)
            output_lines.insert(0, header_line)

            with open(text_file_path, "w") as f:
                f.write("\n".join(output_lines))
        except Exception as e:
            overall_status = "error"
            overall_message = f"Error saving combined files: {str(e)}"

    # Create database record with additional metadata
    db_record = ProcessedFileESI(
        user_id=current_user.id,
        filename=excel_filename,
        filepath=f"{str(excel_file_path)},{str(text_file_path)}",
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
        upload_date=first_day_of_month,
        source_folder=folder_name,
        processed_files_count=len(excel_files),
        success_files_count=len([f for f in processed_files if f["status"] == "success"]),
    )

    try:
        db.add(db_record)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error saving record to database: {str(e)}"
        )

    return FileProcessResult(
        status=overall_status,
        message=overall_message,
        upload_month=upload_month,
        file_path=str(excel_file_path),
        processed_files=processed_files,
        total_files=len(excel_files),
        successful_files=len([f for f in processed_files if f["status"] == "success"]),
    )
########################*******************************************#################################
@app.get("/processed_files_esi", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    upload_month: str = Query(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(get_current_user),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    db: Session = Depends(get_db),
):
    try:
        # Parse the month input
        month_date = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = month_date.replace(day=1)
        last_day_of_month = (first_day_of_month + timedelta(days=32)).replace(
            day=1
        ) - timedelta(days=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    # Base query for files within the month
    query = db.query(ProcessedFileESI).filter(
        ProcessedFileESI.upload_date >= first_day_of_month,
        ProcessedFileESI.upload_date <= last_day_of_month,
    )

    # Apply user filtering
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFileESI.user_id == user_id)
    else:
        query = query.filter(ProcessedFileESI.user_id == current_user.id)

    # Get all files for the given month and user(s)
    files = query.order_by(ProcessedFileESI.created_at.desc()).all()

    # Group files by their timestamp folder (extracted from filepath)
    processed_results = []
    seen_folders = set()

    for file in files:
        if file.status == "success":
            try:
                # Extract the timestamp folder from the filepath
                filepaths = file.filepath.split(",")
                if len(filepaths) == 2:
                    excel_path = Path(filepaths[0])
                    # The parent folder is the timestamp folder
                    timestamp_folder = excel_path.parent.name

                    # Only process each timestamp folder once
                    if timestamp_folder in seen_folders:
                        continue

                    seen_folders.add(timestamp_folder)

                    # Verify both files exist
                    text_path = Path(filepaths[1])
                    if excel_path.exists() and text_path.exists():
                        processed_results.append(file)
                    else:
                        # Update DB record if files are missing
                        file.status = "error"
                        file.message = "Output files not found on server"
                        db.add(file)
                else:
                    file.status = "error"
                    file.message = "Invalid file path format in database"
                    db.add(file)
            except Exception:
                # If any error occurs while processing the filepath, mark as error
                file.status = "error"
                file.message = "Error processing file path"
                db.add(file)
                processed_results.append(file)
        else:
            processed_results.append(file)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Log the error but continue with the response

    # For non-admin users or when specific user_id is provided, return all results
    if current_user.role != Role.ADMIN or user_id is not None:
        return [ProcessedFileResponse.from_orm(file) for file in processed_results]

    # For admin viewing all users without specific user_id filter,
    # return only the most recent processing for each user
    user_latest = {}
    for file in processed_results:
        if (
            file.user_id not in user_latest
            or file.created_at > user_latest[file.user_id].created_at
        ):
            user_latest[file.user_id] = file

    return [ProcessedFileResponse.from_orm(file) for file in user_latest.values()]


# **************************************************************************************
@app.get("/processed_files_esi_new", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    upload_month: str = Query(..., description="Month in MM-YYYY format"),
    current_user: UserModel = Depends(get_current_user),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    db: Session = Depends(get_db),
):
    try:
        # Parse the month input
        month_date = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = month_date.replace(day=1)
        last_day_of_month = (first_day_of_month + timedelta(days=32)).replace(
            day=1
        ) - timedelta(days=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    # Base query for files within the month
    query = db.query(ProcessedFileESI).filter(
        ProcessedFileESI.upload_date >= first_day_of_month,
        ProcessedFileESI.upload_date <= last_day_of_month,
        ProcessedFileESI.filename.like(
            f"combined_pf_{upload_month.replace('-', '_')}%"
        ),
    )

    # Apply user filtering
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFileESI.user_id == user_id)
    else:
        query = query.filter(ProcessedFileESI.user_id == current_user.id)

    # Get the most recent files based on user role
    if current_user.role == Role.ADMIN and user_id is None:
        # For admin viewing all users, get most recent file per user
        subquery = (
            db.query(
                ProcessedFileESI.user_id,
                func.max(ProcessedFileESI.created_at).label("max_created_at"),
            )
            .filter(
                ProcessedFileESI.upload_date >= first_day_of_month,
                ProcessedFileESI.upload_date <= last_day_of_month,
                ProcessedFileESI.filename.like(
                    f"combined_pf_{upload_month.replace('-', '_')}%"
                ),
            )
            .group_by(ProcessedFileESI.user_id)
            .subquery()
        )

        query = query.join(
            subquery,
            and_(
                ProcessedFileESI.user_id == subquery.c.user_id,
                ProcessedFileESI.created_at == subquery.c.max_created_at,
            ),
        )
    else:
        # For single user, get their most recent file
        query = query.order_by(ProcessedFileESI.created_at.desc()).limit(1)

    files = query.all()

    # Verify file existence
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
                    # Update DB record if files are missing
                    file.status = "error"
                    file.message = "Output files not found on server"
                    db.add(file)
            else:
                file.status = "error"
                file.message = "Invalid file path format in database"
                db.add(file)
        else:
            valid_files.append(file)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Log the error but continue with the response

    return [ProcessedFileResponse.from_orm(file) for file in valid_files]


# **********************************************************************************************
@app.get("/processed_files_esi", response_model=List[ProcessedFileResponse])
async def get_processed_files_esi(
    upload_month: str = Query(..., description="Month in MM-YYYY format"),
    user_id: Optional[int] = Query(
        None, description="Specific user ID to filter by (Admin only)"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Parse the month input (consistent with process_folder_esi)
        month_date = datetime.strptime(upload_month, "%m-%Y").date()
        first_day_of_month = month_date.replace(day=1)
        last_day_of_month = (first_day_of_month + timedelta(days=32)).replace(
            day=1
        ) - timedelta(days=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05-2023)",
        )

    # Query for combined files within the month
    query = db.query(ProcessedFileESI).filter(
        ProcessedFileESI.upload_date >= first_day_of_month,
        ProcessedFileESI.upload_date <= last_day_of_month,
        ProcessedFileESI.filename.like(
            f"combined_esi_{upload_month.replace('-', '_')}%"
        ),
    )

    # Apply user filtering
    if current_user.role == Role.ADMIN:
        if user_id is not None:
            query = query.filter(ProcessedFileESI.user_id == user_id)
    else:
        query = query.filter(ProcessedFileESI.user_id == current_user.id)

    # Get only the most recent file for each user/month combination
    if current_user.role == Role.ADMIN and user_id is None:
        # For admin viewing all users, get the most recent file per user
        subquery = (
            db.query(
                ProcessedFileESI.user_id,
                func.max(ProcessedFileESI.created_at).label("max_created_at"),
            )
            .filter(
                ProcessedFileESI.upload_date >= first_day_of_month,
                ProcessedFileESI.upload_date <= last_day_of_month,
                ProcessedFileESI.filename.like(
                    f"combined_esi_{upload_month.replace('-', '_')}%"
                ),
            )
            .group_by(ProcessedFileESI.user_id)
            .subquery()
        )

        query = query.join(
            subquery,
            and_(
                ProcessedFileESI.user_id == subquery.c.user_id,
                ProcessedFileESI.created_at == subquery.c.max_created_at,
            ),
        )
    else:
        # For single user, get their most recent file
        query = query.order_by(ProcessedFileESI.created_at.desc()).limit(1)

    files = query.all()

    # Verify file existence
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


@app.post("/processed_files_esi/{file_id}/submit_remittance")
async def submit_remittance(
    file_id: int,
    remittance_month: str = Form(..., description="Remittance month in MM-YYYY format"),
    remittance_amount: float = Form(..., description="Total remittance amount"),
    remittance_file: UploadFile = File(...),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    # Validate file
    if not remittance_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Validate remittance amount
    if remittance_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Remittance amount must be positive"
        )

    # Parse and validate month format
    try:
        remittance_date = datetime.strptime(remittance_month, "%m-%Y").date()
        first_day_of_month = remittance_date.replace(day=1)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Please use MM-YYYY format (e.g., 05/2023)",
        )

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

    # Create remittance directory structure based on month/year
    month_folder = remittance_date.strftime("%m-%Y")  # Format as MM-YYYY
    remittance_dir = Path("remittance_challans") / month_folder
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
    file.remittance_month = remittance_month  # Store as MM/YYYY string
    file.remittance_month = first_day_of_month  # Store as first day of month
    file.remittance_amount = remittance_amount
    file.remittance_challan_path = str(file_path)
    db.commit()

    return {
        "message": "Remittance submitted successfully",
        "file_path": str(file_path),
        "remittance_month": remittance_month,
        "remittance_amount": remittance_amount,
    }


# *********************************************************************************
@app.post("/processed_files_esi/{file_id}/submit_remittance_new")
async def submit_remittance(
    file_id: int,
    remittance_date: str = Form(
        ..., description="Remittance month in DD-MM-YYYY format"
    ),
    remittance_amount: float = Form(..., description="Total remittance amount"),
    remittance_file: UploadFile = File(...),
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """
    Submit remittance documentation for a processed PF file.
    Automatically uses the file's upload month for organization.
    """
    # Validate file is PDF
    if not remittance_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Validate remittance amount
    if remittance_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Remittance amount must be positive"
        )

    # Get the file record
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if current_user.role not in [Role.HR, Role.ADMIN]:
        raise HTTPException(
            status_code=403, detail="Only HR or Admin can submit remittances"
        )

    # Use the file's original upload month for organization
    if not file.upload_month:
        raise HTTPException(
            status_code=400, detail="File missing upload month information"
        )

    # Create remittance directory using the file's month
    remittance_dir = Path("remittance_challans") / file.upload_month  # MM-YYYY format
    remittance_dir.mkdir(parents=True, exist_ok=True)

    # Generate standardized filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    new_filename = (
        f"PF_Remittance_{file.upload_month.replace('-', '_')}_{file_id}_{timestamp}.pdf"
    )
    file_path = remittance_dir / new_filename

    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(remittance_file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save remittance file: {str(e)}"
        )

    # Update database record
    try:
        file.remittance_submitted = True
        file.remittance_month = file.upload_month  # Use same month as original file
        file.remittance_date = remittance_date  # Use same date as original file
        file.remittance_amount = remittance_amount
        file.remittance_challan_path = str(file_path)
        file.remittance_submitted_at = datetime.now()
        file.remittance_submitted_by = current_user.id
        db.commit()
    except Exception as e:
        # Clean up the saved file if database update fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500, detail=f"Failed to update database: {str(e)}"
        )

    return {
        "status": "success",
        "message": "Remittance submitted successfully",
        "details": {
            "file_id": file_id,
            "remittance_month": file.upload_month,
            "remittnace_date": remittance_date,
            "remittance_amount": remittance_amount,
            "challan_path": str(file_path),
            "submitted_at": datetime.now().isoformat(),
        },
    }


# *********************************************************************************************#
@app.get("/processed_files_esi/{file_id}/remittance_challan_new")
async def download_remittance_challan(
    file_id: int,
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """
    Download a remittance challan PDF for a processed PF file.
    Returns the PDF file with proper filename formatting including month/year.
    """
    # Get the file record
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if remittance exists
    if not file.remittance_submitted or not file.remittance_challan_path:
        raise HTTPException(
            status_code=404, detail="No remittance challan found for this file"
        )

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to access this remittance challan",
        )

    # Verify file exists on server
    challan_path = Path(file.remittance_challan_path)
    if not challan_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Remittance file not found on server. Please contact administrator.",
        )

    # Generate a formatted filename using upload_month from the file record
    filename = f"PF_Remittance_{file.upload_month.replace('-', '_')}_{file_id}.pdf"

    return FileResponse(
        str(challan_path),
        filename=filename,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Remittance-Month": file.upload_month or "",
            "X-Remittance-Amount": (
                str(file.remittance_amount) if file.remittance_amount else "0"
            ),
        },
    )


# ******************************************************************************************************#
@app.get("/processed_files_esi/{file_id}/download_new")
async def download_pf_file(
    file_id: int,
    file_type: str = Query(
        None, regex="^(txt|xlsx)$", description="File type to download (txt or xlsx)"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download processed PF files (Excel or text format) with proper month/year organization.

    Parameters:
    - file_id: ID of the processed file
    - file_type: 'txt' for text file or 'xlsx' for Excel file (defaults to Excel)
    """
    # Get the file record from the database
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only download your own files",
        )

    if file.status != "success":
        raise HTTPException(
            status_code=400,
            detail="File cannot be downloaded as processing was not successful",
        )

    # Parse file paths (stored as "excel_path,txt_path" in database)
    try:
        excel_path, text_path = file.filepath.split(",")
    except ValueError:
        raise HTTPException(
            status_code=500, detail="Invalid file path format in database"
        )

    # Determine which file to serve based on file_type parameter
    if file_type and file_type.lower() == "txt":
        file_path = Path(text_path)
        media_type = "text/plain"
        filename = f"PF_{file.upload_month.replace('-', '_')}_{file_id}.txt"
    else:
        # Default to Excel download
        file_path = Path(excel_path)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"PF_{file.upload_month.replace('-', '_')}_{file_id}.xlsx"

    # Verify file exists
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Requested file not found on server: {file_path.name}",
        )

    # Set content disposition with proper filename
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "X-File-Month": file.upload_month or "",
    }

    return FileResponse(
        path=file_path, filename=filename, media_type=media_type, headers=headers
    )


# ***************************************************************************************************
@app.get("/processed_files_esi/batch_download_new")
async def download_multiple_pf_files(
    file_ids: str = Query(..., description="Comma-separated list of file IDs"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Download multiple PF files as a zip archive, organized by month/year (MM-YYYY) folders.
    Includes both Excel and text versions of each file when available.
    """
    try:
        # Convert comma-separated string to list of integers
        file_ids_list = list(
            {int(id.strip()) for id in file_ids.split(",") if id.strip()}
        )  # Remove duplicates
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file IDs format")

    # Get all requested files from database
    files = (
        db.query(ProcessedFileESI).filter(ProcessedFileESI.id.in_(file_ids_list)).all()
    )

    if not files:
        raise HTTPException(
            status_code=404, detail="No files found with the provided IDs"
        )

    # Verify permissions and file status
    valid_files = []
    for file in files:
        if current_user.role == Role.USER and file.user_id != current_user.id:
            continue  # Skip unauthorized files rather than failing the entire request

        if file.status != "success":
            continue  # Skip failed files

        try:
            # Verify file paths exist
            excel_path, text_path = file.filepath.split(",")
            if not Path(excel_path).exists() or not Path(text_path).exists():
                continue
        except (ValueError, AttributeError):
            continue  # Skip files with invalid paths

        valid_files.append(file)

    if not valid_files:
        raise HTTPException(
            status_code=404, detail="No valid files available for download"
        )

    # Create in-memory zip file
    zip_buffer = BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    files_added = 0

    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file in valid_files:
            try:
                excel_path, text_path = file.filepath.split(",")
                month_folder = file.upload_month or "unknown_month"

                # Create standardized filenames
                base_filename = f"PF_{month_folder.replace('-', '_')}_{file.id}"

                # Add files to zip with organized structure
                zip_dir = f"PF_Files/{month_folder}"

                # Add Excel file
                zip_file.write(excel_path, f"{zip_dir}/{base_filename}.xlsx")
                files_added += 1

                # Add text file
                zip_file.write(text_path, f"{zip_dir}/{base_filename}.txt")
                files_added += 1

            except Exception as e:
                continue  # Skip files that cause errors

    if files_added == 0:
        raise HTTPException(status_code=500, detail="Failed to package any files")

    # Verify zip integrity
    zip_buffer.seek(0)
    try:
        with zipfile.ZipFile(zip_buffer, "r") as test_zip:
            if test_zip.testzip() is not None:
                raise HTTPException(status_code=500, detail="Error creating zip file")
    except:
        raise HTTPException(status_code=500, detail="Error creating zip file")

    # Return the zip file
    zip_buffer.seek(0)

    def cleanup():
        zip_buffer.close()

    background_tasks.add_task(cleanup)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=pf_files_{timestamp}.zip",
            "X-Files-Count": str(files_added),
            "X-Zip-Integrity": "valid",
        },
        background=background_tasks,
    )


# *************************************************************************************************************
@app.get("/processed_files_esi/{file_id}/remittance_challan")
async def download_remittance_challan(
    file_id: int,
    current_user: UserModel = Depends(require_hr_or_admin),
    db: Session = Depends(get_db),
):
    """
    Download a remittance challan PDF for a processed ESI file.
    Returns the PDF file with proper filename formatting including month/year.
    """
    # Get the file record
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if remittance exists
    if not file.remittance_submitted or not file.remittance_challan_path:
        raise HTTPException(
            status_code=404, detail="No remittance challan found for this file"
        )

    # Check permissions
    if (
        current_user.role not in [Role.HR, Role.ADMIN]
        and file.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to access this remittance challan",
        )

    # Verify file exists on server
    challan_path = Path(file.remittance_challan_path)
    if not challan_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Remittance file not found on server. Please contact administrator.",
        )

    # Generate a formatted filename with consistent date format
    try:
        # Ensure remittance_month is in MM-YYYY format
        remittance_month = (
            file.remittance_month.replace("/", "-") if file.remittance_month else ""
        )
        if remittance_month:
            # Validate the format
            datetime.strptime(remittance_month, "%m-%Y")

        filename = f"ESI_Remittance_{remittance_month}_{file_id}.pdf"
    except ValueError:
        filename = f"ESI_Remittance_{file_id}.pdf"
    return FileResponse(
        str(challan_path),
        filename=filename,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Remittance-Month": remittance_month,
            "X-Remittance-Amount": (
                str(file.remittance_amount) if file.remittance_amount else "0"
            ),
        },
    )


@app.get("/processed_files_esi/{file_id}/download")
async def download_esi_file(
    file_id: int,
    file_type: str = Query(
        None, regex="^(txt|xlsx)$", description="File type to download (txt or xlsx)"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download processed ESI files (Excel or text format) with proper month/year organization.
    """
    # Get the file record from the database
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check permissions
    if current_user.role == Role.USER and file.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only download your own files",
        )

    if file.status != "success":
        raise HTTPException(
            status_code=400,
            detail="File cannot be downloaded as processing was not successful",
        )

    # Parse file paths (stored as "excel_path,txt_path" in database)
    try:
        excel_path, text_path = file.filepath.split(",")
    except ValueError:
        raise HTTPException(
            status_code=500, detail="Invalid file path format in database"
        )

    # Get month/year from upload_month (consistent MM-YYYY format)
    month_folder = file.upload_month if file.upload_month else ""

    # Construct filename with consistent format
    try:
        if month_folder:
            # Validate the format
            datetime.strptime(month_folder, "%m-%Y")
            month_part = month_folder.replace("-", "_")
        else:
            month_part = "unknown_date"

        filename = f"ESI_{month_part}_{file_id}.{file_type if file_type else 'xlsx'}"
    except ValueError:
        filename = f"ESI_{file_id}.{file_type if file_type else 'xlsx'}"

    # Determine which file to serve
    if file_type and file_type.lower() == "txt":
        file_path = Path(text_path)
        media_type = "text/plain"
    else:
        file_path = Path(excel_path)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Verify file exists
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Requested file not found on server: {file_path.name}",
        )

    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "X-File-Month": month_folder,
    }

    return FileResponse(
        path=file_path, filename=filename, media_type=media_type, headers=headers
    )


@app.get("/processed_files_esi/batch_download")
async def download_multiple_pf_files(
    file_ids: str = Query(..., description="Comma-separated list of file IDs"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Download multiple PF files as a zip archive, organized by month/year (MM-YYYY) folders.
    Includes both Excel and text versions of each file when available.
    """
    try:
        # Convert comma-separated string to list of integers
        file_ids_list = list(
            {int(id.strip()) for id in file_ids.split(",") if id.strip()}
        )  # Remove duplicates
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file IDs format")

    # Get all requested files from database
    files = (
        db.query(ProcessedFileESI).filter(ProcessedFileESI.id.in_(file_ids_list)).all()
    )

    if not files:
        raise HTTPException(
            status_code=404, detail="No files found with the provided IDs"
        )

    # Verify permissions and file status
    for file in files:
        if current_user.role == Role.USER and file.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=f"You don't have permission to download file ID {file.id}",
            )

        if file.status != "success":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot download file ID {file.id} - processing was not successful",
            )

    # Create in-memory zip file
    zip_buffer = BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    files_added = 0

    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for file in files:
            try:
                # Get both file paths (Excel and text)
                filepaths = file.filepath.split(",")
                if len(filepaths) != 2:
                    continue  # skip invalid entries

                # Get month/year folder name (MM-YYYY format)
                month_folder = (
                    file.upload_date.strftime("%m-%Y")
                    if file.upload_date
                    else "unknown_month"
                )

                # Construct file paths using MM-YYYY folder structure
                excel_path = (
                    Path("processed_excels_esi_new")
                    / month_folder
                    / Path(filepaths[0]).name
                )
                text_path = (
                    Path("processed_texts_esi_new")
                    / month_folder
                    / Path(filepaths[1]).name
                )

                # Prepare base filename without extension
                original_name = os.path.splitext(file.filename)[0]
                zip_dir = f"PF_Files/{month_folder}/{original_name}"

                # Add Excel file if exists
                if excel_path.exists():
                    zip_file.write(excel_path, f"{zip_dir}/{original_name}.xlsx")
                    files_added += 1
                elif Path(filepaths[0]).exists():  # Fallback to original path
                    zip_file.write(
                        Path(filepaths[0]), f"{zip_dir}/{original_name}.xlsx"
                    )
                    files_added += 1

                # Add text file if exists
                if text_path.exists():
                    zip_file.write(text_path, f"{zip_dir}/{original_name}.txt")
                    files_added += 1
                elif Path(filepaths[1]).exists():  # Fallback to original path
                    zip_file.write(Path(filepaths[1]), f"{zip_dir}/{original_name}.txt")
                    files_added += 1

            except Exception as e:
                # Skip files that cause errors but continue with others
                continue

    if files_added == 0:
        raise HTTPException(status_code=404, detail="No valid files found for download")

    # Verify zip integrity
    zip_buffer.seek(0)
    try:
        with zipfile.ZipFile(zip_buffer, "r") as test_zip:
            if test_zip.testzip() is not None:
                raise HTTPException(status_code=500, detail="Error creating zip file")
    except:
        raise HTTPException(status_code=500, detail="Error creating zip file")

    # Return the zip file
    zip_buffer.seek(0)

    def cleanup():
        zip_buffer.close()

    background_tasks.add_task(cleanup)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=pf_files_{timestamp}.zip",
            "X-Files-Count": str(files_added),
            "X-Zip-Integrity": "valid",
        },
        background=background_tasks,
    )


@app.get("/dashboard/remittance_stats_viz", response_model=RemittanceDashboardStats)
async def get_remittance_dashboard_stats(
    year: int = Query(None, description="Filter by specific year"),
    month: int = Query(
        None, description="Optional month filter (1-12) for summary cards"
    ),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enhanced remittance dashboard statistics with improved data structure"""
    current_year = year or datetime.now().year

    def apply_user_filter(query, model):
        """Apply user-based filtering to queries"""
        if current_user.role not in [Role.ADMIN]:
            return query.filter(model.user_id == current_user.id)
        return query

    # Get all data in parallel for better performance
    results = await asyncio.gather(
        get_monthly_amounts(db, current_year, apply_user_filter),
        get_submission_timeline_data(
            db, current_year, apply_user_filter, ProcessedFilePF
        ),
        get_submission_timeline_data(
            db, current_year, apply_user_filter, ProcessedFileESI
        ),
        get_delayed_submissions(db, current_year, apply_user_filter),
        get_summary_stats(db, current_year, month, apply_user_filter),
    )

    challan_data, pf_submissions, esi_submissions, delayed_data, summary_stats = results

    # Create response model
    stats = RemittanceDashboardStats(
        monthly_amounts=MonthlyAmountData(
            labels=challan_data["labels"], datasets=challan_data["datasets"]
        ),
        pf_submissions=SubmissionData(
            labels=pf_submissions["labels"], points=pf_submissions["points"]
        ),
        esi_submissions=SubmissionData(
            labels=esi_submissions["labels"], points=esi_submissions["points"]
        ),
        delayed_submissions=DelayedData(
            labels=delayed_data["labels"],
            datasets={
                "PF": [
                    [DelayedSubmission(**sub) for sub in month_subs]
                    for month_subs in delayed_data["datasets"]["PF"]
                ],
                "ESI": [
                    [DelayedSubmission(**sub) for sub in month_subs]
                    for month_subs in delayed_data["datasets"]["ESI"]
                ],
            },
        ),
        summary_stats=summary_stats,
        year=current_year,
    )

    return stats

    return stats


async def get_summary_stats(db: Session, year: int, month: Optional[int], filter_fn):
    """Get summary statistics for the dashboard with optional month filter"""
    base_filters = [
        extract("year", ProcessedFilePF.remittance_month) == year,
        ProcessedFilePF.remittance_submitted == True,
    ]

    if month:
        base_filters.append(extract("month", ProcessedFilePF.remittance_month) == month)

    # Total PF Amount
    pf_query = db.query(
        func.sum(ProcessedFilePF.remittance_amount).label("total_amount"),
        func.count(ProcessedFilePF.id).label("count"),
        func.avg(ProcessedFilePF.remittance_amount).label("avg_amount"),
    ).filter(*base_filters)

    pf_query = filter_fn(pf_query, ProcessedFilePF)
    pf_result = pf_query.first()

    # Total ESI Amount
    esi_base_filters = [
        extract("year", ProcessedFileESI.remittance_month) == year,
        ProcessedFileESI.remittance_submitted == True,
    ]

    if month:
        esi_base_filters.append(
            extract("month", ProcessedFileESI.remittance_month) == month
        )

    esi_query = db.query(
        func.sum(ProcessedFileESI.remittance_amount).label("total_amount"),
        func.count(ProcessedFileESI.id).label("count"),
        func.avg(ProcessedFileESI.remittance_amount).label("avg_amount"),
    ).filter(*esi_base_filters)

    esi_query = filter_fn(esi_query, ProcessedFileESI)
    esi_result = esi_query.first()

    # On-time submissions (submitted by 15th of next month)
    on_time_filters = [
        ProcessedFilePF.remittance_submitted == True,
        extract("year", ProcessedFilePF.remittance_month) == year,
        ProcessedFilePF.remittance_date
        <= func.date(
            ProcessedFilePF.remittance_month + text("'-01'"), "+1 month", "-16 days"
        ),
    ]

    if month:
        on_time_filters.append(
            extract("month", ProcessedFilePF.remittance_month) == month
        )

    on_time_pf = db.query(func.count(ProcessedFilePF.id)).filter(*on_time_filters)
    on_time_pf = filter_fn(on_time_pf, ProcessedFilePF)
    on_time_pf_count = on_time_pf.scalar() or 0

    total_pf_submissions = pf_result.count if pf_result else 0
    on_time_rate = (
        on_time_pf_count / total_pf_submissions if total_pf_submissions > 0 else 0
    )

    return {
        "total_pf": str(pf_result.total_amount) if pf_result else "0",
        "total_esi": str(esi_result.total_amount) if esi_result else "0",
        "pf_submissions": total_pf_submissions,
        "esi_submissions": esi_result.count if esi_result else 0,
        "on_time_rate": on_time_rate,
        "avg_pf": (
            str(pf_result.avg_amount) if pf_result and pf_result.avg_amount else "0"
        ),
        "avg_esi": (
            str(esi_result.avg_amount) if esi_result and esi_result.avg_amount else "0"
        ),
    }


async def get_submission_timeline_data(db: Session, year: int, filter_fn, model):
    """Get submission timeline data for scatter plot (either PF or ESI)"""
    # Query for submission dates and amounts
    query = db.query(
        extract("month", model.remittance_month).label("month"),
        extract("day", model.remittance_date).label("day"),
        model.remittance_amount.label("amount"),
    ).filter(
        model.remittance_submitted == True,
        model.remittance_date.isnot(None),
        model.remittance_amount.isnot(None),
        extract("year", model.remittance_month) == year,
    )

    query = filter_fn(query, model)
    results = query.all()

    return format_submission_timeline_data(results)


def format_submission_timeline_data(results):
    """Structure submission timeline data for visualization"""
    month_labels = [
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
    ]

    # Initialize data structure - one array per month for points
    points = [[] for _ in range(12)]

    for result in results:
        month = result.month - 1  # Convert to 0-based index
        day = result.day
        amount = result.amount

        # Validate data before adding
        if 0 <= month < 12 and day and amount:
            points[month].append(
                {"x": int(day), "y": float(amount), "r": 5}  # Radius for the point
            )

    return {"labels": month_labels, "points": points}


async def get_monthly_amounts(db: Session, year: int, filter_fn):
    """Get aggregated monthly remittance amounts for both PF and ESI"""
    # PF amounts
    pf_query = db.query(
        extract("month", ProcessedFilePF.remittance_month).label("month"),
        func.sum(ProcessedFilePF.remittance_amount).label("total_amount"),
    ).filter(
        ProcessedFilePF.remittance_submitted == True,
        ProcessedFilePF.remittance_amount.isnot(None),
    )

    if year:
        pf_query = pf_query.filter(
            extract("year", ProcessedFilePF.remittance_month) == year
        )

    pf_query = filter_fn(pf_query, ProcessedFilePF)
    pf_results = pf_query.group_by("month").all()

    # ESI amounts
    esi_query = db.query(
        extract("month", ProcessedFileESI.remittance_month).label("month"),
        func.sum(ProcessedFileESI.remittance_amount).label("total_amount"),
    ).filter(
        ProcessedFileESI.remittance_submitted == True,
        ProcessedFileESI.remittance_amount.isnot(None),
    )

    if year:
        esi_query = esi_query.filter(
            extract("year", ProcessedFileESI.remittance_month) == year
        )

    esi_query = filter_fn(esi_query, ProcessedFileESI)
    esi_results = esi_query.group_by("month").all()

    return format_monthly_amounts(pf_results, esi_results)


def format_monthly_amounts(pf_results, esi_results):
    """Structure monthly amount data for visualization"""
    month_labels = [
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
    ]

    pf_data = [0.0] * 12
    esi_data = [0.0] * 12

    for result in pf_results:
        if 1 <= result.month <= 12:
            pf_data[result.month - 1] = float(result.total_amount or 0)

    for result in esi_results:
        if 1 <= result.month <= 12:
            esi_data[result.month - 1] = float(result.total_amount or 0)

    return {"labels": month_labels, "datasets": {"PF": pf_data, "ESI": esi_data}}


async def get_delayed_submissions(db: Session, year: int, filter_fn):
    """Get data about delayed submissions"""
    # Calculate expected due date (15th of next month)
    # and compare with actual submission date

    pf_query = db.query(
        extract("month", ProcessedFilePF.remittance_month).label("month"),
        extract("day", ProcessedFilePF.remittance_date).label("day"),
        (
            func.julianday(ProcessedFilePF.remittance_date)
            - func.julianday(
                func.date(
                    ProcessedFilePF.remittance_month + text("-01"),
                    "+1 month",
                    "-16 days",
                )
            )
        ).label("delay_days"),
        ProcessedFilePF.remittance_amount.label("amount"),
    ).filter(
        ProcessedFilePF.remittance_submitted == True,
        ProcessedFilePF.remittance_date.isnot(None),
    )
    if year:
        pf_query = pf_query.filter(
            extract("year", ProcessedFilePF.remittance_month) == year
        )

    pf_query = filter_fn(pf_query, ProcessedFilePF)
    pf_results = pf_query.all()

    esi_query = db.query(
        extract("month", ProcessedFileESI.remittance_month).label("month"),
        extract("day", ProcessedFileESI.remittance_date).label("day"),
        func.julianday(ProcessedFileESI.remittance_date)
        - func.julianday(
            func.date(
                ProcessedFileESI.remittance_month + text("-01"), "+1 month", "-16 days"
            )
        ).label("delay_days"),
        ProcessedFileESI.remittance_amount.label("amount"),
    ).filter(
        ProcessedFileESI.remittance_submitted == True,
        ProcessedFileESI.remittance_date.isnot(None),
    )

    if year:
        esi_query = esi_query.filter(
            extract("year", ProcessedFileESI.remittance_month) == year
        )

    esi_query = filter_fn(esi_query, ProcessedFileESI)
    esi_results = esi_query.all()

    return format_delayed_data(pf_results, esi_results)


def format_delayed_data(pf_results, esi_results):
    """Structure delayed submissions data"""
    month_labels = [
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
    ]

    pf_data = [[] for _ in range(12)]
    esi_data = [[] for _ in range(12)]

    for result in pf_results:
        if 1 <= result.month <= 12:
            pf_data[result.month - 1].append(
                {
                    "delay_days": int(result.delay_days or 0),
                    "amount": float(result.amount or 0),
                }
            )

    for result in esi_results:
        if 1 <= result.month <= 12:
            esi_data[result.month - 1].append(
                {
                    "delay_days": int(result.delay_days or 0),
                    "amount": float(result.amount or 0),
                }
            )

    return {"labels": month_labels, "datasets": {"PF": pf_data, "ESI": esi_data}}


# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)


# Call the function to create tables
create_db_tables()


@app.get("/uploads/by-year-days/")
def get_upload_days_by_year(
    year: int = Query(..., description="Year to filter uploads")
):
    session = SessionLocal()
    try:
        results = (
            session.query(ProcessedFileESI.upload_month, ProcessedFileESI.upload_date)
            .filter(ProcessedFileESI.upload_date != None)
            .filter(ProcessedFileESI.upload_date.like(f"{year}-%"))
            .all()
        )
        results2 = (
            session.query(ProcessedFilePF.upload_month, ProcessedFilePF.upload_date)
            .filter(ProcessedFilePF.upload_date != None)
            .filter(ProcessedFilePF.upload_date.like(f"{year}-%"))
            .all()
        )
        return {
            "esi": [
                {"month": row.upload_month, "day": row.upload_date.day}
                for row in results
            ],
            "pf": [
                {
                    "month": datetime.strptime(row.upload_month, "%m-%Y").strftime(
                        "%B"
                    ),
                    "day": row.upload_date.day,
                }
                for row in results2
            ],
        }
    finally:
        session.close()
