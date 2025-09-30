# backend/database.py - Database configuration and models

from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, object_session
from datetime import datetime
from typing import Any, Dict
import json
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

class FlagCategory(Base):
    __tablename__ = "flag_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    description = Column(Text)

    flagged_documents = relationship("FlaggedDocument", back_populates="category")
    decision_rules = relationship(
        "FlagDecisionRule", back_populates="flag_category", cascade="all, delete-orphan"
    )


class DecisionCategory(Base):
    __tablename__ = "decision_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    description = Column(Text)
    severity = Column(String)

    decision_rules = relationship(
        "FlagDecisionRule", back_populates="decision_category", cascade="all, delete-orphan"
    )


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
    flag_category_id = Column(Integer, ForeignKey("flag_categories.id"), nullable=True)
    bias_review_id = Column(String, ForeignKey("bias_reviews.id"), nullable=True, index=True)

    # Relationships
    user = relationship("User", back_populates="flagged_documents")
    document = relationship("Document", back_populates="flags")
    application = relationship("Application", back_populates="flagged_documents")
    flagged_by_officer = relationship("Officer", back_populates="flagged_documents")
    category = relationship("FlagCategory", back_populates="flagged_documents")
    bias_review = relationship("BiasReview", back_populates="flags")

    @property
    def flag_type(self) -> str:
        return self.category.code if self.category else None

    @flag_type.setter
    def flag_type(self, code: str) -> None:
        if code is None:
            self.category = None
            self.flag_category_id = None
            return

        session = object_session(self)
        if session is None:
            raise ValueError(
                "FlaggedDocument must be attached to a session to set flag_type by code."
            )

        category = session.query(FlagCategory).filter(FlagCategory.code == code).one_or_none()
        if category is None:
            raise ValueError(f"Unknown flag category code '{code}'")

        self.category = category


class FlagDecisionRule(Base):
    __tablename__ = "flag_decision_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flag_category_id = Column(Integer, ForeignKey("flag_categories.id"), nullable=False)
    decision_id = Column(Integer, ForeignKey("decision_categories.id"), nullable=False)
    requires_follow_up = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("flag_category_id", "decision_id", name="uq_flag_decision"),)

    flag_category = relationship("FlagCategory", back_populates="decision_rules")
    decision_category = relationship("DecisionCategory", back_populates="decision_rules")

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
    audit_status = Column(String, default="pending")  # pending or any decision code (e.g. clear_to_proceed, escalate_to_policy, overturn_flag)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", backref="bias_reviews")
    officer = relationship("Officer", backref="bias_reviews")
    audits = relationship("ReviewAudit", back_populates="review", cascade="all, delete-orphan")
    flags = relationship("FlaggedDocument", back_populates="bias_review")


class ReviewAudit(Base):
    __tablename__ = "review_audits"

    id = Column(String, primary_key=True, index=True)
    bias_review_id = Column(String, ForeignKey("bias_reviews.id"), nullable=False)
    auditor_id = Column(String, ForeignKey("officers.id"), nullable=False)
    decision_code = Column(String, ForeignKey("decision_categories.code"), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("BiasReview", back_populates="audits")
    auditor = relationship("Officer")
    decision_category = relationship("DecisionCategory")

    @property
    def decision(self) -> str:
        return self.decision_code

    @decision.setter
    def decision(self, value: str) -> None:
        self.decision_code = value


class JsonMixin:
    """Provide convenience helpers for JSON-encoded text columns."""

    @staticmethod
    def _json_load(value: str, default: Any) -> Any:
        if not value:
            return default
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default

    @staticmethod
    def _json_dump(value: Any) -> str:
        return json.dumps(value)


class BiasMonitoringSnapshot(Base, JsonMixin):
    __tablename__ = "bias_monitoring_snapshots"

    id = Column(String, primary_key=True, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    total_rejected = Column(Integer, default=0)
    sampled_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)
    bias_detected_count = Column(Integer, default=0)
    bias_rate = Column(Float, default=0.0)
    window_days = Column(Integer, default=30)
    snapshot_data = Column(Text)  # JSON payload with patterns, breakdowns, alert flags


class BiasInfluenceAttribute(Base, JsonMixin):
    __tablename__ = "bias_influence_attributes"

    id = Column(String, primary_key=True, index=True)
    category_id = Column(String, index=True)
    category_title = Column(String)
    label = Column(String, nullable=False)
    explanation = Column(Text)
    config = Column(Text)  # JSON payload mirroring docs/bias_influence_model.md

    factors = relationship("BiasInfluenceFactor", back_populates="attribute")

    def as_glossary_entry(self) -> Dict[str, Any]:
        config = self._json_load(self.config, {})
        return {
            "id": self.id,
            "label": config.get("label", self.label),
            "explanation": config.get("explanation", self.explanation or ""),
            "category_id": self.category_id,
            "category_title": self.category_title,
        }


class BiasInfluenceModel(Base, JsonMixin):
    __tablename__ = "bias_influence_models"

    id = Column(String, primary_key=True, index=True)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    window_days = Column(Integer, default=30)
    sample_size = Column(Integer, default=0)
    auc = Column(Float, default=0.0)
    refreshed_at = Column(DateTime, default=datetime.utcnow, index=True)
    model_metadata = Column(Text)  # JSON payload for diagnostics (class weights, etc.)
    warnings = Column(Text)  # JSON array of warning strings

    factors = relationship("BiasInfluenceFactor", back_populates="model", cascade="all, delete-orphan")

    def metadata_dict(self) -> Dict[str, Any]:
        return self._json_load(self.model_metadata, {})

    def warnings_list(self) -> Any:
        return self._json_load(self.warnings, [])


class BiasInfluenceFactor(Base, JsonMixin):
    __tablename__ = "bias_influence_factors"

    id = Column(String, primary_key=True, index=True)
    model_id = Column(String, ForeignKey("bias_influence_models.id"), nullable=False, index=True)
    attribute_id = Column(String, ForeignKey("bias_influence_attributes.id"), nullable=False, index=True)
    coefficient = Column(Float, default=0.0)
    odds_ratio = Column(Float, default=1.0)
    sample_share = Column(Float, default=0.0)
    prevalence_weight = Column(Float, default=0.0)
    p_value = Column(Float)
    delta = Column(Float, default=0.0)
    direction = Column(String, default="driver")
    extra = Column(Text)  # JSON payload for additional metrics (confidence weight, etc.)

    model = relationship("BiasInfluenceModel", back_populates="factors")
    attribute = relationship("BiasInfluenceAttribute", back_populates="factors")

    def as_leaderboard_entry(self) -> Dict[str, Any]:
        extra = self._json_load(self.extra, {})
        return {
            "attribute_id": self.attribute_id,
            "display_label": extra.get("display_label", self.attribute.label if self.attribute else ""),
            "coefficient": self.coefficient,
            "odds_ratio": self.odds_ratio,
            "sample_share": self.sample_share,
            "p_value": self.p_value,
            "delta": self.delta,
            "direction": self.direction,
            "prevalence_weight": self.prevalence_weight,
            "confidence_weight": extra.get("confidence_weight"),
            "occurrences": extra.get("occurrences"),
        }


class BiasReviewCadence(Base):
    __tablename__ = "bias_review_cadence"

    id = Column(String, primary_key=True, index=True)
    interval = Column(String, nullable=False)
    review_time = Column(String, nullable=False)
    view_time = Column(String, nullable=False)
    cases = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)


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
