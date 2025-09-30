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

class FlaggedDocumentResponse(BaseModel):
    id: str
    user_id: str
    document_id: str
    application_id: str
    reason: Optional[str]
    flagged_by_officer_id: Optional[str]
    flagged_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    flag_type: Optional[str] = None
    document: Optional[DocumentResponse] = None
    audit_status: Optional[str] = None
    audit_notes: Optional[str] = None
    audit_decision_code: Optional[str] = None
    audit_decision_label: Optional[str] = None
    audited_by_officer_id: Optional[str] = None
    audited_at: Optional[datetime] = None

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

    # List of flagged documents for this application
    flagged_documents: Optional[List[FlaggedDocumentResponse]] = []
    resolved_flag_history: Optional[List[FlaggedDocumentResponse]] = []

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

# Additional request models for flagging
class FlagDocumentRequest(BaseModel):
    document_id: str
    reason: str
    officer_id: Optional[str] = None
    flag_category_code: Optional[str] = None

class UnflagDocumentRequest(BaseModel):
    flag_id: str

# AI Document Analysis Models
class ProblemSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    CRITICAL = "critical"

class DocumentClassificationResponse(BaseModel):
    """Document type classification result"""
    document_type: str = Field(description="Detected document type")
    confidence: float = Field(description="Confidence score 0.0-1.0", ge=0.0, le=1.0)
    is_correct_type: bool = Field(description="Whether document matches expected type")

class ExtractedDataResponse(BaseModel):
    """Key data extracted from document"""
    text_content: str = Field(description="Main text content")
    dates: List[str] = Field(description="All dates found in document")
    amounts: List[str] = Field(description="Financial amounts found")
    names: List[str] = Field(description="Person/entity names found")

class DetectedProblemResponse(BaseModel):
    """Problems found in document"""
    problem_type: str = Field(description="Type of problem detected")
    severity: ProblemSeverity = Field(description="Problem severity level")
    description: str = Field(description="Human-readable problem description")
    suggestion: str = Field(description="How to fix the problem")

class DocumentAnalysisResponse(BaseModel):
    """Complete AI analysis of document"""
    classification: DocumentClassificationResponse
    extracted_data: ExtractedDataResponse
    problems: List[DetectedProblemResponse]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    is_authentic: bool = Field(description="Whether document appears authentic")
    processing_time_ms: int
    analyzed_at: datetime

class DocumentWithAnalysis(BaseModel):
    """Extended document response with AI analysis"""
    id: str
    name: str
    type: str
    size: int
    verified: bool
    uploaded_at: datetime
    file_path: str
    ai_analysis: Optional[DocumentAnalysisResponse] = None

    class Config:
        from_attributes = True
