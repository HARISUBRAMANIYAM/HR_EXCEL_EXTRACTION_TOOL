from sqlalchemy import (
    Column,
    Float,
    Integer,
    String,
    Boolean,
    DateTime,
    JSON,
    Time,
    ForeignKey,
    Text,
    Enum,
    create_engine,
    Date,
)
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum as PyEnum
from sqlalchemy.orm import Session, sessionmaker, relationship
from schemas import *
from passlib.context import CryptContext
from sqlalchemy import Enum


SQLALCHEMY_DATABASE_URL = "sqlite:///./hr_extraction2.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.USER, nullable=False)
    disabled = Column(Boolean, default=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        default=datetime.now(),
        nullable=False,
    )
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
    upload_date = Column(Date, nullable=True)
    upload_month = Column(String)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    remittance_submitted = Column(Boolean, default=False, nullable=False)
    remittance_date = Column(String, nullable=True)
    remittance_month = Column(String, nullable=True)
    remittance_amount = Column(Float)
    remittance_challan_path = Column(String, nullable=True)
    user = relationship("UserModel", back_populates="processed_files_pf")


class ProcessedFileESI(Base):
    __tablename__ = "processed_files_esi"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    status = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    upload_date = Column(Date, nullable=True)
    upload_month = Column(String)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    remittance_submitted = Column(Boolean, default=False, nullable=False)
    remittance_date = Column(String, nullable=True)
    remittance_month = Column(String, nullable=True)
    remittance_amount = Column(Float)
    remittance_challan_path = Column(String, nullable=True)
    user = relationship("UserModel", back_populates="processed_files_esi")


UserModel.processed_files_pf = relationship("ProcessedFilePF", back_populates="user")
UserModel.processed_files_esi = relationship("ProcessedFileESI", back_populates="user")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Include all other SQLAlchemy models here
