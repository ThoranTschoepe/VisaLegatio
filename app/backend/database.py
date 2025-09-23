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
    
    # Relationships
    applications = relationship("Application", back_populates="user")
    flagged_documents = relationship("FlaggedDocument", back_populates="user")

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
    flagged_documents = relationship("FlaggedDocument", back_populates="application")

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
    flags = relationship("FlaggedDocument", back_populates="document")

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
    flagged_documents = relationship("FlaggedDocument", back_populates="flagged_by_officer")

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

class FlaggedDocument(Base):
    __tablename__ = "flagged_documents"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    application_id = Column(String, ForeignKey("applications.id"), nullable=False)
    reason = Column(Text)
    flagged_by_officer_id = Column(String, ForeignKey("officers.id"))
    flagged_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="flagged_documents")
    document = relationship("Document", back_populates="flags")
    application = relationship("Application", back_populates="flagged_documents")
    flagged_by_officer = relationship("Officer", back_populates="flagged_documents")

class DocumentAnalysis(Base):
    __tablename__ = "document_analyses"
    
    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    
    # Classification results
    detected_document_type = Column(String)
    classification_confidence = Column(Float)
    is_correct_type = Column(Boolean)
    
    # Extracted data (stored as JSON)
    extracted_text = Column(Text)  # Full text content
    detected_dates = Column(Text)  # JSON array of dates
    detected_amounts = Column(Text)  # JSON array of amounts
    detected_names = Column(Text)  # JSON array of names
    
    # Analysis results
    problems_detected = Column(Text)  # JSON array of problems
    overall_confidence = Column(Float)
    is_authentic = Column(Boolean)
    processing_time_ms = Column(Integer)
    
    # Metadata
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    ai_model_version = Column(String, default="gemini-2.0-flash-exp")
    
    # Relationship
    document = relationship("Document", backref="ai_analysis")

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

class BiasReview(Base):
    __tablename__ = "bias_reviews"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("applications.id"), nullable=False)
    officer_id = Column(String, ForeignKey("officers.id"), nullable=False)
    result = Column(String, nullable=False)  # justified, biased, uncertain
    notes = Column(Text)
    ai_confidence = Column(Integer)
    audit_status = Column(String, default="pending")  # pending, validated, escalated, overturned
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", backref="bias_reviews")
    officer = relationship("Officer", backref="bias_reviews")
    audits = relationship("BiasReviewAudit", back_populates="review", cascade="all, delete-orphan")


class BiasReviewAudit(Base):
    __tablename__ = "bias_review_audits"

    id = Column(String, primary_key=True, index=True)
    bias_review_id = Column(String, ForeignKey("bias_reviews.id"), nullable=False)
    auditor_id = Column(String, ForeignKey("officers.id"), nullable=False)
    decision = Column(String, nullable=False)  # validated, overturned, escalated, training_needed
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("BiasReview", back_populates="audits")
    auditor = relationship("Officer")


class BiasMonitoringSnapshot(Base):
    __tablename__ = "bias_monitoring_snapshots"

    id = Column(String, primary_key=True, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    total_rejected = Column(Integer, default=0)
    sampled_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)
    bias_detected_count = Column(Integer, default=0)
    bias_rate = Column(Float, default=0.0)
    snapshot_data = Column(Text)  # JSON payload with patterns, breakdowns, alert flags


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
