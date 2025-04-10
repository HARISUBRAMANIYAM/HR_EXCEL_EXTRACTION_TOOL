'''from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import os
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy import ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Enum
from sqlalchemy.orm import Session, sessionmaker, relationship
from sqlalchemy.sql import func
import pandas as pd
import uuid
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import shutil
from typing import Annotated
from enum import Enum as PyEnum

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

# Secret key for JWT
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
SQLALCHEMY_DATABASE_URL = "sqlite:///./hr_extraction.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enum for user roles
class Role(str, PyEnum):
    USER = "user"
    HR = "hr"
    ADMIN = "admin"

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

class ProcessedFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    status: str
    message: str
    created_at: datetime
    updated_at: datetime

class DashboardStats(BaseModel):
    total_files: int
    success_files: int
    error_files: int
    recent_files: List[ProcessedFileResponse]

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
    processed_files = relationship("ProcessedFile", back_populates="user")

class ProcessedFile(Base):
    __tablename__ = "processed_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    status = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    user = relationship("UserModel", back_populates="processed_files")

UserModel.processed_files = relationship("ProcessedFile", back_populates="user")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Utility functions
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# Endpoint to handle folder path for processing
@app.post("/process_folder", response_model=FileProcessResult)
async def process_folder(
    folder_path: str = Form(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = Path(folder_path)
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFile(
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
        db_file = ProcessedFile(
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
                    db_file = ProcessedFile(
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
                error_message = f"Error reading Excel file {excel_file.name}: {e}"
                db_file = ProcessedFile(
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
                required_attributes = [
                    "UAN No",
                    "Employee Name",
                    "Gross wages",
                    "PF Gross",
                    "LOP",
                ]
                missing_attributes = [
                    attr for attr in required_attributes if attr not in df.columns
                ]
                if missing_attributes:
                    error_message = f"The following attributes are missing in the Excel file {excel_file.name}: {', '.join(missing_attributes)}"
                    db_file = ProcessedFile(
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

                uan_no = df["UAN No"]
                member_name = df["Employee Name"]
                gross_wages = df["Gross wages"]
                pf_gross = df["Gross wages"]
                lop_days = df["LOP"]

                epf_wages = pf_gross
                eps_wages = pf_gross.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = pf_gross.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = pf_gross * 0.12
                eps_contrib_remitted = eps_wages * 0.0367
                epf_eps_diff_remitted = epf_contrib_remitted - eps_contrib_remitted
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

                excel_output_dir = Path("processed_excels")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                excel_filename = f"{uuid.uuid4()}.xlsx"
                excel_file_path = excel_output_dir / excel_filename
                output_df.to_excel(excel_file_path, index=False)

                text_output_dir = Path("processed_texts")
                text_output_dir.mkdir(parents=True, exist_ok=True)
                text_filename = f"{uuid.uuid4()}.txt"
                text_file_path = text_output_dir / text_filename

                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)

                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))

                db_file = ProcessedFile(
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
                error_message = f"Error processing file {excel_file.name}: {e}"
                db_file = ProcessedFile(
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
            error_message = f"Unexpected error processing folder: {e}"
            db_file = ProcessedFile(
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

# Dashboard endpoint
@app.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get all files for the current user (or all files if admin/HR)
    query = db.query(ProcessedFile)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFile.user_id == current_user.id)

    total_files = query.count()
    success_files = query.filter(ProcessedFile.status == "success").count()
    error_files = query.filter(ProcessedFile.status == "error").count()
    
    recent_files = query.order_by(ProcessedFile.created_at.desc()).limit(5).all()
    
    return DashboardStats(
        total_files=total_files,
        success_files=success_files,
        error_files=error_files,
        recent_files=recent_files
    )

# Get processed files endpoint
@app.get("/processed_files", response_model=List[ProcessedFileResponse])
async def get_processed_files(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ProcessedFile)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFile.user_id == current_user.id)
    
    files = query.order_by(ProcessedFile.created_at.desc()).all()
    return files

# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)

# Call the function to create tables
create_db_tables()'''
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import os
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy import ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Enum
from sqlalchemy.orm import Session, sessionmaker, relationship
from sqlalchemy.sql import func
import pandas as pd
import uuid
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import shutil
from typing import Annotated
from enum import Enum as PyEnum
from fastapi.responses import FileResponse

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

# Secret key for JWT
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
SQLALCHEMY_DATABASE_URL = "sqlite:///./hr_extraction.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enum for user roles
class Role(str, PyEnum):
    USER = "user"
    HR = "hr"
    ADMIN = "admin"

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

class ProcessedFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    status: str
    message: str
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
    processed_files = relationship("ProcessedFile", back_populates="user")

class ProcessedFile(Base):
    __tablename__ = "processed_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    status = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    user = relationship("UserModel", back_populates="processed_files")

UserModel.processed_files = relationship("ProcessedFile", back_populates="user")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Utility functions
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# Endpoint to handle folder path for processing
@app.post("/process_folder", response_model=FileProcessResult)
async def process_folder(
    folder_path: str = Form(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = Path(folder_path)
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFile(
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
        db_file = ProcessedFile(
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
                    db_file = ProcessedFile(
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
                error_message = f"Error reading Excel file {excel_file.name:{e}}"
                db_file = ProcessedFile(
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
                required_attributes = [
                    "UAN No",
                    "Employee Name",
                    "Gross wages",
                    "PF Gross",
                    "LOP",
                ]
                missing_attributes = [
                    attr for attr in required_attributes if attr not in df.columns
                ]
                if missing_attributes:
                    error_message = f"The following attributes are missing in the Excel file {excel_file.name}: {', '.join(missing_attributes)}"
                    db_file = ProcessedFile(
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

                uan_no = df["UAN No"]
                member_name = df["Employee Name"]
                gross_wages = df["Gross wages"]
                pf_gross = df["Gross wages"]
                lop_days = df["LOP"]

                epf_wages = pf_gross
                eps_wages = pf_gross.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = pf_gross.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = pf_gross * 0.12
                eps_contrib_remitted = eps_wages * 0.0367
                epf_eps_diff_remitted = epf_contrib_remitted - eps_contrib_remitted
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

                excel_output_dir = Path("processed_excels")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                excel_filename = f"{uuid.uuid4()}.xlsx"
                excel_file_path = excel_output_dir / excel_filename
                output_df.to_excel(excel_file_path, index=False)

                text_output_dir = Path("processed_texts")
                text_output_dir.mkdir(parents=True, exist_ok=True)
                text_filename = f"{uuid.uuid4()}.txt"
                text_file_path = text_output_dir / text_filename

                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)

                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))

                db_file = ProcessedFile(
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
                error_message = f"Error processing file {excel_file.name}: {e}"
                db_file = ProcessedFile(
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
            error_message = f"Unexpected error processing folder: {e}"
            db_file = ProcessedFile(
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

# Dashboard endpoint
@app.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get all files for the current user (or all files if admin/HR)
    query = db.query(ProcessedFile)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFile.user_id == current_user.id)

    total_files = query.count()
    success_files = query.filter(ProcessedFile.status == "success").count()
    error_files = query.filter(ProcessedFile.status == "error").count()
   
    recent_files = query.order_by(ProcessedFile.created_at.desc()).limit(5).all()
   
    return DashboardStats(
        total_files=total_files,
        success_files=success_files,
        error_files=error_files,
        recent_files=[ProcessedFileResponse.from_orm(file) for file in recent_files]
    )

# Get processed files endpoint
@app.get("/processed_files", response_model=List[ProcessedFileResponse])
async def get_processed_files(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ProcessedFile)
    if current_user.role not in [Role.HR, Role.ADMIN]:
        query = query.filter(ProcessedFile.user_id == current_user.id)
   
    files = query.order_by(ProcessedFile.created_at.desc()).all()
    return [ProcessedFileResponse.from_orm(file) for file in files]



@app.get("/processed_files/{file_id}/download")
async def download_file(
    file_id: int,
    file_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get the file record from the database
    file = db.query(ProcessedFile).filter(ProcessedFile.id == file_id).first()
    
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
@app.get("/directory_files", response_model=Dict[str, List[DirectoryFile]])
async def list_directory_files(
    current_user: UserModel = Depends(get_current_user),
):
    # Define directories to scan
    excel_dir = "D:\\MyProject\\backend\\processed_excels"
    text_dir = "D:\\MyProject\\backend\\processed_texts"
    
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
@app.get("/directory_files/{file_type}/{filename}")
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

# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)

# Call the function to create tables
create_db_tables()