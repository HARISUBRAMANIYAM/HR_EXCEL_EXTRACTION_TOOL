from enum import Enum
from datetime import time, date
from typing import Optional, List, Any, Dict
from collections import defaultdict
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum as PyEnum


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


class ChangePasswordRequest(BaseModel):
    username: str
    current_password: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


class FileProcessResult(BaseModel):
    file_path: str
    status: str
    message: str
    upload_date: Optional[date] = None


class ProcessedFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    status: str
    message: str
    upload_date: Optional[date] = None
    remittance_submitted: bool = False
    remittance_date: Optional[date] = None
    remittance_challan_path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @validator("updated_at", pre=True)
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
    monthly_stats: Dict[str, Any]  # New field for monthly breakdown
    remittance_stats: Dict[str, Any]  # New field for remittance tracking
    user_activity: Dict[str, Any]
    remittance_delays: List[Dict[str, Any]]


class DirectoryFile(BaseModel):
    filename: str
    filepath: str
    size: int
    created_at: str
    type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
