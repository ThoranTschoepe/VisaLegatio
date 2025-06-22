# backend/models.py - Pydantic models for API validation and serialization

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enums
class VisaType(str, Enum):
    TOURIST = "tourist"
    BUSINESS = "business"
    STUDENT = "student"
    WORK = "work"
    FAMILY_VISIT = "family_visit"
    TRANSIT = "transit"

class ApplicationStatus(str, Enum):
    SUBMITTED = "submitted"
    DOCUMENT_REVIEW = "document_review"
    BACKGROUND_CHECK = "background_check"
    OFFICER_REVIEW = "officer_review"
    APPROVED = "approved"
    REJECTED = "rejected"

class Priority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class DocumentType(str, Enum):
    PASSPORT = "passport"
    PHOTO = "photo"
    BANK_STATEMENT = "bank_statement"
    INVITATION_LETTER = "invitation_letter"
    TRAVEL_INSURANCE = "travel_insurance"
    EMPLOYMENT_LETTER = "employment_letter"
    FLIGHT_ITINERARY = "flight_itinerary"

# Request Models
class ApplicationCreate(BaseModel):
    visa_type: VisaType
    answers: Dict[str, Any]
    documents: Optional[List[Dict[str, Any]]] = []

class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    officer_id: Optional[str] = None

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class OfficerLogin(BaseModel):
    officer_id: str
    password: str
    embassy: str

class DocumentUpload(BaseModel):
    application_id: str
    name: str
    type: DocumentType
    size: Optional[int] = None

# Response Models
class UserResponse(BaseModel):
    id: str
    email: Optional[str]
    name: Optional[str]
    nationality: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    name: str
    type: str
    size: Optional[int]
    verified: bool
    uploaded_at: datetime
    file_path: Optional[str]

    class Config:
        from_attributes = True

class StatusUpdateResponse(BaseModel):
    id: str
    status: str
    notes: Optional[str]
    officer_id: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class ApplicationResponse(BaseModel):
    id: str
    user_id: str
    visa_type: str
    status: str
    priority: str
    risk_score: int
    answers: Dict[str, Any]
    submitted_at: datetime
    updated_at: datetime
    estimated_decision: Optional[datetime]
    approval_probability: Optional[int]
    assigned_officer_id: Optional[str]
    
    # Computed fields for frontend
    applicant_name: Optional[str] = None
    country: Optional[str] = None
    documents_count: Optional[int] = None
    estimated_days: Optional[int] = None
    last_activity: Optional[datetime] = None

    flagged_document_id: Optional[str] = None
    flagged_document_reason: Optional[str] = None
    flagged_by_officer: Optional[str] = None
    flagged_at: Optional[datetime] = None
    flagged_document: Optional[DocumentResponse] = None
    
    # Relationships
    documents: Optional[List[DocumentResponse]] = []
    status_updates: Optional[List[StatusUpdateResponse]] = []

    class Config:
        from_attributes = True

class OfficerResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    embassy_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    response: str
    suggested_visa_type: Optional[VisaType] = None
    next_action: str = "continue_chat"  # continue_chat, start_form, upload_documents, submit_application
    confidence: Optional[float] = None
    follow_up_questions: Optional[List[str]] = []

class AnalyticsResponse(BaseModel):
    total_applications: int
    approval_rate: float
    avg_processing_time: float
    pending_applications: int
    trends_data: List[Dict[str, Any]]
    visa_type_distribution: List[Dict[str, Any]]
    country_stats: List[Dict[str, Any]]
    processing_time_by_type: List[Dict[str, Any]]

# Question models for dynamic forms
class QuestionValidation(BaseModel):
    min: Optional[int] = None
    max: Optional[int] = None
    pattern: Optional[str] = None
    message: Optional[str] = None

class QuestionDependency(BaseModel):
    question_id: str
    value: Any

class Question(BaseModel):
    id: str
    text: str
    type: str  # text, select, number, date, file
    options: Optional[List[str]] = None
    required: bool = True
    validation: Optional[QuestionValidation] = None
    depends_on: Optional[QuestionDependency] = None

class FormQuestionsResponse(BaseModel):
    questions: List[Question]