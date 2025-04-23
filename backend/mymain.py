from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form,Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, List
from datetime import date, datetime, timedelta,time
import os
import math
from jose import JWTError, jwt
from sqlalchemy import ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Enum,JSON,DATETIME,Time,Date
from sqlalchemy.orm import Session, sessionmaker, relationship
from sqlalchemy.sql import func
import pandas as pd
import uuid
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import shutil
from fastapi.responses import StreamingResponse
from typing import Annotated
from fastapi.responses import FileResponse
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Time, ForeignKey, Text, Enum, create_engine,Date
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum as PyEnum
from sqlalchemy.orm import Session, sessionmaker, relationship
from passlib.context import CryptContext
from sqlalchemy import Enum
from enum import Enum
from datetime import time
from typing import Optional, List
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum as PyEnum
from jose import jwt,JWTError
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import os
from  datetime import datetime,timedelta,timezone
from fastapi import HTTPException,Depends
# alembic/versions/xxxx_update_role_enum.py

from alembic import op
import sqlalchemy as sa

def upgrade():
    # For SQLite (which you're using)
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('role', 
                            type_=sa.Enum('user', 'hr', 'admin', 'finance', name='role_enum'),
                            existing_type=sa.Enum('user', 'hr', 'admin', name='role_enum'))

def downgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('role', 
                            type_=sa.Enum('user', 'hr', 'admin', name='role_enum'),
                            existing_type=sa.Enum('user', 'hr', 'admin', 'finance', name='role_enum'))

SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
# Utility functions
SQLALCHEMY_DATABASE_URL = "sqlite:///./hr_extraction2.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
class ProcessingType(str, Enum):
    PF = "pf"
    ESI = "esi"

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_after_validator_function(
            cls,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

# Enum for user roles
class Role(str, PyEnum):
    USER = "user"
    HR = "hr"
    ADMIN = "admin"
    FINANCE ="finance"

class UserBase(BaseModel):
    username: str = Field(..., min_length=4, max_length=50)
    email: str = Field(..., max_length=100)
    full_name: str = Field(..., max_length=100)
    role: Role = Field(default=Role.USER)
    disabled: Optional[bool] = False

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

class User(UserBase):
    id: int
    hashed_password: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: Role
    created_at: datetime
    updated_at: datetime

class FileProcessResult(BaseModel):
    file_path: str
    status: str
    message: str
    upload_date:Optional[date]=None

class ProcessedFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    status: str
    message: str
    upload_date:Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @validator('updated_at', pre=True)
    def handle_none_updated_at(cls, v):
        return v if v is not None else datetime.now()

    class Config:
        from_attributes = True
class DashboardStats(BaseModel):
    total_files: int
    success_files: int
    error_files: int
    recent_files: List[ProcessedFileResponse]
    pf_files: Optional[int] = None  # Optional breakdown
    esi_files: Optional[int] = None  # Optional breakdown
    pf_success: Optional[int] = None
    pf_error: Optional[int] = None
    esi_success: Optional[int] = None
    esi_error: Optional[int] = None
class DirectoryFile(BaseModel):
    filename: str
    filepath: str
    size: int
    created_at: str
    type: str
class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.USER, nullable=False)
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), default=datetime.now(), nullable=False)
    processed_files_pf = relationship("ProcessedFilePF", back_populates="user")
    processed_files_esi = relationship("ProcessedFileESI", back_populates="user")
class ProcessedFilePF(Base):
    __tablename__ = "processed_files_pf"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    status = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    upload_date = Column(Date,nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    user = relationship("UserModel", back_populates="processed_files_pf")
class ProcessedFileESI(Base):
    __tablename__ = "processed_files_esi"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    status = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    user = relationship("UserModel", back_populates="processed_files_esi")
UserModel.processed_files_pf = relationship("ProcessedFilePF", back_populates="user")
UserModel.processed_files_esi = relationship("ProcessedFileESI", back_populates="user")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Role(str, PyEnum):
    USER = "user"
    HR = "hr"
    ADMIN = "admin"

class ProcessingSchedule(Base):
    __tablename__ = "processing_schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    process_type = Column(String(10), nullable=False)
    frequency = Column(String(10), nullable=False)
    run_time = Column(Time, nullable=False)
    days_of_week = Column(JSON, nullable=True)
    day_of_month = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    next_run = Column(DateTime, nullable=True)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


app = FastAPI()
# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
        to_encode["exp"] = expire
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")



# Dependency to get the current user
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token: No sub claim")
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid user")
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {e}")

# Role checking dependency
async def check_user_role(required_role: Role, current_user: UserModel = Depends(get_current_user)):
    if current_user.role != required_role and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=403,
            detail=f"Operation not permitted. Requires {required_role} role."
        )
    return current_user
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
    folder_path: str = Form(..., min_length=3, max_length=500),
    upload_date: str = Form(..., description="Date of upload in YYYY-MM-DD format"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Validate the upload date format
        upload_date_obj = datetime.strptime(upload_date, "%Y-%m-%d").date()
        date_folder_name = upload_date_obj.strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Please use YYYY-MM-DD format"
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

    # Create date-based output directories
    excel_output_dir = Path("processed_excels_pf") / date_folder_name
    text_output_dir = Path("processed_texts_pf") / date_folder_name
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
                uan_no = df[column_mapping['UAN No']].astype(str).str.replace("-","")
                member_name = df[column_mapping["Employee Name"]]
                gross_wages = df[column_mapping["Gross Wages"]].fillna(0).round().astype(int)
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

                # Calculate derived fields
                eps_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = (epf_wages * 0.12).round().astype(int)
                eps_contrib_remitted = (eps_wages * 0.0833).round().astype(int)
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
                    upload_date=upload_date_obj
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
        upload_date=upload_date_obj
    )