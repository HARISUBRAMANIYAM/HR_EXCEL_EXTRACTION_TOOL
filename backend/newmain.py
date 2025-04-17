from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, List
from datetime import datetime, timedelta,time
import os
from jose import JWTError, jwt
from sqlalchemy import ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Enum,JSON,DATETIME,Time
from sqlalchemy.orm import Session, sessionmaker, relationship
from sqlalchemy.sql import func
import pandas as pd
import uuid
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import shutil
from typing import Annotated
from fastapi.responses import FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from models import *
from schemas import *
from utils import *
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
async def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user
@app.post("/process_folder_pf", response_model=FileProcessResult)
async def process_folder(
    folder_path: str = Form(...,min_length=3,max_length=500),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = Path(folder_path)
    if not folder_path.strip():
        raise HTTPException(status_code=422,detail="Folder path cannot be empty")
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

    for excel_file in excel_files:
        try:
            try:
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file)
                else:
                    df = pd.read_excel(excel_file, engine="xlrd")
               
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
                    "LOP Days": ["LOP", "LOP Days"]
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
                df[column_mapping["UAN No"]]=pd.to_numeric(df[column_mapping["UAN No"]],errors='coerce').fillna(0).astype(int)
                uan_str = df[column_mapping["UAN No"]].astype(str)
                uan_no = uan_str.str.replace("-","").astype("int64")
                member_name = df[column_mapping["Employee Name"]]
                gross_wages = df[column_mapping["Gross Wages"]].fillna(0).round().astype(int)
                epf_wages = df[column_mapping["EPF Wages"]].fillna(0).round().astype(int)
                lop_days = df[column_mapping["LOP Days"]]
                
                # Calculate derived fields
                eps_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = (epf_wages * 0.12).round().astype(int)
                eps_contrib_remitted = (eps_wages * 0.0833).round().astype(int)  # 8.33%
                epf_eps_diff_remitted = (epf_contrib_remitted - eps_contrib_remitted).astype(int)
                ncp_days = lop_days
                refund_of_advances = 0

                output_df = pd.DataFrame({
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
                })

                # Create output directories if they don't exist
                excel_output_dir = Path("processed_excels_pf")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_pf")
                text_output_dir.mkdir(parents=True, exist_ok=True)

                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename
                output_df.to_excel(excel_file_path, index=False)
                # Prepare text file content
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
    )
@app.get("/processed_files_pf", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ProcessedFilePF)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFilePF.user_id == current_user.id)
    files = query.order_by(ProcessedFilePF.created_at.desc()).all()
    return [ProcessedFileResponse.from_orm(file) for file in files]

@app.get("/processed_files_pf/{file_id}/download")
async def download_pf_file(
    file_id: int,
    file_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
     # Get the file record from the database
    file = db.query(ProcessedFilePF).filter(ProcessedFilePF.id == file_id).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if user has access to this file
    if current_user.role not in [Role.HR, Role.ADMIN] and file.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to download this file")
    
    # Check if the file status is 'success'
    if file.status != "success":
        raise HTTPException(status_code=400, detail="Cannot download file with non-success status")
    
    # The filepath field contains both excel and text filepaths separated by comma
    filepaths = file.filepath.split(",")
    
    if len(filepaths) != 2:
        raise HTTPException(status_code=500, detail="Invalid file path format in database")
    
    excel_path = Path(filepaths[0])
    text_path = Path(filepaths[1])
    
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
        raise HTTPException(status_code=404, detail=f"File not found on server: {file_path}")
    
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
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )
@app.get("/directory_files_pf", response_model=Dict[str, List[DirectoryFile]])
async def list_esi_directory_files(
    current_user: UserModel = Depends(get_current_user),
):
    excel_dir = "D:\\MyProject\\backend\\processed_excels_pf"
    text_dir = "D:\\MyProject\\backend\\processed_texts_pf"
     
    # Check if directories exist
    if not os.path.exists(excel_dir):
        raise HTTPException(status_code=404, detail=f"Excel directory not found: {excel_dir}")
    if not os.path.exists(text_dir):
        raise HTTPException(status_code=404, detail=f"Text directory not found: {text_dir}")
    
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
                    type="excel"
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
                    type="text"
                )
            )
    
    return {
        "excel_files": excel_files,
        "text_files": text_files
    }
# Add this endpoint to download files directly from directories
@app.get("/directory_files_pf/{file_type}/{filename}")
async def download_directory_file(
    file_type: str,
    filename: str,
    current_user: UserModel = Depends(get_current_user),
):
    # Validate file_type
    if file_type not in ["excel", "text"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Must be 'excel' or 'text'")
    
    # Determine directory based on file type
    base_dir = "D:\\MyProject\\backend\\processed_excels" if file_type == "excel" else "D:\\MyProject\\backend\\processed_texts"
    
    # Construct full file path
    file_path = os.path.join(base_dir, filename)
    
    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    # Determine media type
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if file_type == "excel" else "text/plain"
    
    # Return file as a response
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )
#*****************************************************************#
@app.post("/esi_upload", response_model=FileProcessResult)
async def process_esi_file(
    folder_path: str = Form(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."
    for excel_file in excel_files:
        try:
            try:
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file)
                else:
                    df = pd.read_excel(excel_file, engine="xlrd")
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
                    "Worked Days": ["Worked days"]
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
                # Process the data with correct logic
                df[column_mapping["ESI No"]]=pd.to_numeric(df[column_mapping["ESI No"]],errors='coerce').fillna(0).astype(int)
                esi_str = df[column_mapping["ESI No"]].astype(str)
                esi_no = esi_str.str.replace("-","").astype("int64")
                member_name = df[column_mapping["Employee Name"]]
                esi_gross = df[column_mapping["ESI Gross"]].fillna(0).round().astype(int)
                worked_days = df[column_mapping["Worked Days"]]

                output_df = pd.DataFrame({
                    "ESI No": esi_no,
                    "MEMBER NAME": member_name,
                    "ESI GROSS": esi_gross,
                    "WORKED DAYS": worked_days
                })
                # Create output directories if they don't exist
                excel_output_dir = Path("processed_excels_esi")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_esi")
                text_output_dir.mkdir(parents=True, exist_ok=True)
                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}_esi.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}_esi.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename
                output_df.to_excel(excel_file_path, index=False)
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
    )
@app.get("/directory_files_esi", response_model=Dict[str, List[DirectoryFile]])
async def list_esi_directory_files(
    current_user: UserModel = Depends(get_current_user),
):
    excel_dir = "D:\\MyProject\\backend\\processed_excels_esi"
    text_dir = "D:\\MyProject\\backend\\processed_texts_esi"
     
    # Check if directories exist
    if not os.path.exists(excel_dir):
        raise HTTPException(status_code=404, detail=f"Excel directory not found: {excel_dir}")
    if not os.path.exists(text_dir):
        raise HTTPException(status_code=404, detail=f"Text directory not found: {text_dir}")
    
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
                    type="excel"
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
                    type="text"
                )
            )
    
    return {
        "excel_files": excel_files,
        "text_files": text_files
    }
@app.get("/processed_files_esi", response_model=List[ProcessedFileResponse])
async def get_processed_files_pf(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ProcessedFileESI)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFileESI.user_id == current_user.id)
    files = query.order_by(ProcessedFileESI.created_at.desc()).all()
    return [ProcessedFileResponse.from_orm(file) for file in files]

@app.get("/processed_files_esi/{file_id}/download")
async def download_esi_file(
    file_id: int,
    file_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get the file record from the database
    file = db.query(ProcessedFileESI).filter(ProcessedFileESI.id == file_id).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if user has access to this file
    if current_user.role not in [Role.HR, Role.ADMIN] and file.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to download this file")
    
    # Check if the file status is 'success'
    if file.status != "success":
        raise HTTPException(status_code=400, detail="Cannot download file with non-success status")
    
    # The filepath field contains both excel and text filepaths separated by comma
    filepaths = file.filepath.split(",")
    
    if len(filepaths) != 2:
        raise HTTPException(status_code=500, detail="Invalid file path format in database")
    
    excel_path = Path(filepaths[0])
    text_path = Path(filepaths[1])
    
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
        raise HTTPException(status_code=404, detail=f"File not found on server: {file_path}")
    
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
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )
@app.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
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
    
    # Combine and sort recent files
    all_recent = pf_recent + esi_recent
    all_recent_sorted = sorted(all_recent, key=lambda x: x.created_at, reverse=True)[:5]
    
    # Convert to response models
    recent_files_response = []
    for file in all_recent_sorted:
        if isinstance(file, ProcessedFilePF):
            recent_files_response.append(ProcessedFileResponse.from_orm(file))
        else:
            recent_files_response.append(ProcessedFileResponse.from_orm(file))
    
    return DashboardStats(
        total_files=total_files,
        success_files=success_files,
        error_files=error_files,
        recent_files=recent_files_response,
         pf_files=pf_total,  # Add breakdown values
        esi_files=esi_total,
        pf_success=pf_success,
        pf_error=pf_error,
        esi_success=esi_success,
        esi_error=esi_error
    )
# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)

# Call the function to create tables
create_db_tables()