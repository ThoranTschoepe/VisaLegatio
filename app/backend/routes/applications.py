# backend/routes/applications.py - Fixed version

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime, timedelta

from database import get_db, User, Application, Document, StatusUpdate
from models import ApplicationCreate, ApplicationResponse, ApplicationUpdate, FormQuestionsResponse, Question
from utils import generate_id, calculate_risk_score, calculate_approval_probability, get_form_questions as get_visa_form_questions

router = APIRouter()

@router.get("/", response_model=List[ApplicationResponse])
async def get_applications(
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name or ID"),
    db: Session = Depends(get_db)
):
    """Get all applications with optional filtering"""
    
    query = db.query(Application)
    
    # Filter by status
    if status and status != "all":
        query = query.filter(Application.status == status)
    
    applications = query.order_by(Application.submitted_at.desc()).all()
    
    # Process applications for frontend
    result = []
    for app in applications:
        answers = json.loads(app.answers) if app.answers else {}
        
        # Get document count
        doc_count = db.query(Document).filter(Document.application_id == app.id).count()
        
        app_data = ApplicationResponse(
            id=app.id,
            user_id=app.user_id,
            visa_type=app.visa_type,
            status=app.status,
            priority=app.priority,
            risk_score=app.risk_score,
            answers=answers,
            submitted_at=app.submitted_at,
            updated_at=app.updated_at,
            estimated_decision=app.estimated_decision,
            approval_probability=app.approval_probability,
            assigned_officer_id=app.assigned_officer_id,
            
            # Computed fields
            applicant_name=answers.get("applicant_name", f"Applicant {app.id[-4:]}"),
            country=answers.get("destination_country", "Unknown"),
            documents_count=doc_count,
            estimated_days=get_estimated_days(app.status, app.visa_type),
            last_activity=app.updated_at
        )
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            if (search_lower not in app_data.id.lower() and 
                search_lower not in (app_data.applicant_name or "").lower()):
                continue
        
        result.append(app_data)
    
    return result

@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(application_id: str, db: Session = Depends(get_db)):
    """Get a specific application by ID"""
    
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get related data
    documents = db.query(Document).filter(Document.application_id == application_id).all()
    status_updates = db.query(StatusUpdate).filter(StatusUpdate.application_id == application_id).all()
    
    answers = json.loads(app.answers) if app.answers else {}
    
    return ApplicationResponse(
        id=app.id,
        user_id=app.user_id,
        visa_type=app.visa_type,
        status=app.status,
        priority=app.priority,
        risk_score=app.risk_score,
        answers=answers,
        submitted_at=app.submitted_at,
        updated_at=app.updated_at,
        estimated_decision=app.estimated_decision,
        approval_probability=app.approval_probability,
        assigned_officer_id=app.assigned_officer_id,
        
        # Computed fields
        applicant_name=answers.get("applicant_name", f"Applicant {app.id[-4:]}"),
        country=answers.get("destination_country", "Unknown"),
        documents_count=len(documents),
        estimated_days=get_estimated_days(app.status, app.visa_type),
        last_activity=app.updated_at,
        
        # Relationships
        documents=[{
            "id": doc.id,
            "name": doc.name,
            "type": doc.type,
            "size": doc.size,
            "verified": doc.verified,
            "uploaded_at": doc.uploaded_at,
            "file_path": doc.file_path
        } for doc in documents],
        status_updates=[{
            "id": update.id,
            "status": update.status,
            "notes": update.notes,
            "officer_id": update.officer_id,
            "timestamp": update.timestamp
        } for update in status_updates]
    )

@router.post("/", response_model=ApplicationResponse)
async def create_application(application: ApplicationCreate, db: Session = Depends(get_db)):
    """Create a new visa application"""
    
    # Generate IDs
    app_id = generate_id("VSV")
    user_id = generate_id("user")
    
    # Calculate risk score and approval probability
    risk_score = calculate_risk_score(application.visa_type, application.answers)
    approval_probability = calculate_approval_probability(risk_score, application.documents)
    
    # Create user (simplified for demo)
    user = User(
        id=user_id,
        email=application.answers.get("email", f"user{app_id[-6:]}@example.com"),
        name=application.answers.get("applicant_name", "Demo User"),
        phone=application.answers.get("phone", ""),
        nationality=application.answers.get("nationality", "")
    )
    db.add(user)
    
    # Create application
    new_app = Application(
        id=app_id,
        user_id=user_id,
        visa_type=application.visa_type,
        status="submitted",
        priority=get_priority_from_risk(risk_score),
        risk_score=risk_score,
        answers=json.dumps(application.answers),
        estimated_decision=datetime.utcnow() + timedelta(days=get_estimated_days("submitted", application.visa_type)),
        approval_probability=approval_probability
    )
    db.add(new_app)
    
    # Create initial status update
    status_update = StatusUpdate(
        id=generate_id("status"),
        application_id=app_id,
        status="submitted",
        notes="Application submitted successfully",
        timestamp=datetime.utcnow()
    )
    db.add(status_update)
    
    # Create documents
    for doc_data in application.documents:
        document = Document(
            id=generate_id("doc"),
            application_id=app_id,
            name=doc_data.get("name", "Unknown Document"),
            type=doc_data.get("type", "unknown"),
            size=doc_data.get("size", 0),
            verified=doc_data.get("verified", False)
        )
        db.add(document)
    
    db.commit()
    db.refresh(new_app)
    
    return ApplicationResponse(
        id=new_app.id,
        user_id=new_app.user_id,
        visa_type=new_app.visa_type,
        status=new_app.status,
        priority=new_app.priority,
        risk_score=new_app.risk_score,
        answers=json.loads(new_app.answers),
        submitted_at=new_app.submitted_at,
        updated_at=new_app.updated_at,
        estimated_decision=new_app.estimated_decision,
        approval_probability=new_app.approval_probability,
        assigned_officer_id=new_app.assigned_officer_id,
        
        applicant_name=application.answers.get("applicant_name", "Demo User"),
        country=application.answers.get("destination_country", "Unknown"),
        documents_count=len(application.documents),
        estimated_days=get_estimated_days("submitted", application.visa_type),
        last_activity=new_app.updated_at
    )

@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: str, 
    update: ApplicationUpdate, 
    db: Session = Depends(get_db)
):
    """Update application status (used by embassy officers)"""
    
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update fields
    if update.status:
        app.status = update.status
        app.updated_at = datetime.utcnow()
        
        # Create status update record
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=application_id,
            status=update.status,
            notes=update.notes,
            officer_id=update.officer_id,
            timestamp=datetime.utcnow()
        )
        db.add(status_update)
    
    if update.officer_id:
        app.assigned_officer_id = update.officer_id
    
    db.commit()
    db.refresh(app)
    
    # Return updated application
    return await get_application(application_id, db)

@router.get("/{visa_type}/questions", response_model=FormQuestionsResponse)
async def get_questions_for_visa_type(visa_type: str):
    """Get dynamic form questions for a visa type"""
    
    # Call the utility function with proper name
    questions = get_visa_form_questions(visa_type, {})
    return FormQuestionsResponse(questions=questions)

# Utility functions
def get_estimated_days(status: str, visa_type: str) -> int:
    """Calculate estimated processing days based on status and visa type"""
    base_days = {
        "tourist": 7,
        "business": 10,
        "student": 21,
        "work": 30,
        "family_visit": 14,
        "transit": 3
    }
    
    status_multipliers = {
        "submitted": 1.0,
        "document_review": 0.8,
        "background_check": 0.6,
        "officer_review": 0.3,
        "approved": 0,
        "rejected": 0
    }
    
    base = base_days.get(visa_type, 10)
    multiplier = status_multipliers.get(status, 1.0)
    
    return max(1, int(base * multiplier))

def get_priority_from_risk(risk_score: int) -> str:
    """Determine priority based on risk score"""
    if risk_score >= 80:
        return "urgent"
    elif risk_score >= 60:
        return "high"
    elif risk_score >= 30:
        return "normal"
    else:
        return "low"