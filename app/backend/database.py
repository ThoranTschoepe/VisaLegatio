# backend/database.py - Database configuration and models

from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
import os

# Database configuration
DATABASE_URL = "sqlite:///./visaverge.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    phone = Column(String)
    nationality = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    flagged_document_id = Column(String, ForeignKey("documents.id"))
    flagged_document_reason = Column(Text)
    flagged_by_officer_id = Column(String, ForeignKey("officers.id"))
    flagged_at = Column(DateTime)
    
    # Relationships
    applications = relationship("Application", back_populates="user")
    flagged_document = relationship("Document", foreign_keys=[flagged_document_id])
    flagged_by_officer = relationship("Officer", foreign_keys=[flagged_by_officer_id])

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    visa_type = Column(String, nullable=False)
    status = Column(String, default="submitted")  # submitted, document_review, background_check, officer_review, approved, rejected
    priority = Column(String, default="normal")   # low, normal, high, urgent
    risk_score = Column(Integer, default=0)
    answers = Column(Text)  # JSON blob
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    estimated_decision = Column(DateTime)
    approval_probability = Column(Integer)
    assigned_officer_id = Column(String, ForeignKey("officers.id"))
    
    # Relationships
    user = relationship("User", back_populates="applications")
    documents = relationship("Document", back_populates="application")
    status_updates = relationship("StatusUpdate", back_populates="application")
    assigned_officer = relationship("Officer", back_populates="assigned_applications")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("applications.id"))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # passport, photo, bank_statement, etc.
    size = Column(Integer)
    verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)
    
    # Relationships
    application = relationship("Application", back_populates="documents")

class Officer(Base):
    __tablename__ = "officers"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True)
    role = Column(String, nullable=False)  # Senior Consular Officer, Consular Officer, etc.
    embassy_id = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)  # In real app, use proper hashing
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    assigned_applications = relationship("Application", back_populates="assigned_officer")
    status_updates = relationship("StatusUpdate", back_populates="officer")

class StatusUpdate(Base):
    __tablename__ = "status_updates"
    
    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("applications.id"))
    status = Column(String, nullable=False)
    notes = Column(Text)
    officer_id = Column(String, ForeignKey("officers.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    application = relationship("Application", back_populates="status_updates")
    officer = relationship("Officer", back_populates="status_updates")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, index=True)
    message = Column(Text, nullable=False)
    sender = Column(String, nullable=False)  # 'user' or 'ava'
    message_metadata = Column(Text)  # JSON blob for confidence, suggestions, etc.
    timestamp = Column(DateTime, default=datetime.utcnow)

class Metric(Base):
    __tablename__ = "metrics"
    
    id = Column(String, primary_key=True, index=True)
    metric_type = Column(String, nullable=False)  # applications_count, approval_rate, etc.
    metric_value = Column(Float, nullable=False)
    period = Column(String, nullable=False)  # daily, weekly, monthly
    date = Column(DateTime, nullable=False)
    embassy_id = Column(String)

# Database functions
def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_session() -> Session:
    """Get database session for direct use"""
    return SessionLocal()