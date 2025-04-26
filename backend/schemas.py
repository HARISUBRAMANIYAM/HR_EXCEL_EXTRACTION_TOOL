from enum import Enum
from datetime import time, date
from typing import Optional, List, Any, Dict
from collections import defaultdict
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum as PyEnum
from typing import List, Dict, Any
from pydantic import BaseModel


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
    refresh_token: str


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
    upload_month: str  # This was missing in your response
    processed_files: List[dict] = []
    total_files: int = 0
    successful_files: int = 0

    class Config:
        orm_mode = True


class ProcessedFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    status: str
    message: str
    upload_date: Optional[date] = None
    remittance_submitted: bool = False
    remittance_date: Optional[str] = None
    remittance_challan_path: Optional[str] = None
    remittance_amount: Optional[float]
    created_at: datetime
    remittance_month: Optional[str] = None
    updated_at: Optional[datetime] = None
    source_folder: Optional[str] = None
    processed_files_count: Optional[int] = None
    success_files_count: Optional[int] = None
    excel_file_url: Optional[str] = None
    text_file_url: Optional[str] = None

    @validator("updated_at", pre=True)
    def handle_none_updated_at(cls, v):
        return v if v is not None else datetime.now()

    class Config:
        from_attributes = True


class ChartData(BaseModel):
    labels: List[str]
    data: List[float]


class RemittanceDashboardStats(BaseModel):
    challan_amounts: ChartData
    pf_submissions: ChartData
    esi_submissions: ChartData
    delayed_submissions: ChartData


class DirectoryFile(BaseModel):
    filename: str
    filepath: str
    size: int
    created_at: str
    type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SubmissionPoint(BaseModel):
    """Data point for submission scatter plot"""

    x: int  # Day of month
    y: float  # Amount
    r: int = 5  # Radius


class DelayedSubmission(BaseModel):
    """Data point for delayed submissions"""

    delay_days: int
    amount: float


class MonthlyAmountData(BaseModel):
    """Monthly amounts data structure"""

    labels: List[str]  # Month names
    datasets: Dict[str, List[float]]  # PF and ESI amounts


class SubmissionData(BaseModel):
    """Submission timeline data"""

    labels: List[str]  # Month names
    points: List[List[SubmissionPoint]]  # Points for each month


class DelayedData(BaseModel):
    """Delayed submissions data"""

    labels: List[str]  # Month names
    datasets: Dict[str, List[List[DelayedSubmission]]]  # PF and ESI delayed submissions


class SummaryStats(BaseModel):
    """Summary statistics for dashboard"""

    total_pf: str
    total_esi: str
    pf_submissions: int
    esi_submissions: int
    on_time_rate: float
    avg_pf: str
    avg_esi: str


class RemittanceDashboardStats(BaseModel):
    """Complete dashboard statistics response"""

    monthly_amounts: MonthlyAmountData
    pf_submissions: SubmissionData
    esi_submissions: SubmissionData
    delayed_submissions: DelayedData
    summary_stats: SummaryStats
    year: int


class DelayedData(BaseModel):
    labels: List[str]
    datasets: Dict[str, List[List[DelayedSubmission]]]


class RemittanceDashboardStats(BaseModel):
    monthly_amounts: MonthlyAmountData
    pf_submissions: SubmissionData
    esi_submissions: SubmissionData
    delayed_submissions: DelayedData
    summary_stats: SummaryStats
    year: int
