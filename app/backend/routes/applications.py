# backend/routes/applications.py - Updated with document requirements and processing logic

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import hashlib
from datetime import datetime, timedelta

from database import get_db, User, Application, Document, StatusUpdate
from models import ApplicationCreate, ApplicationResponse, ApplicationUpdate, FormQuestionsResponse, Question
from utils import generate_id, calculate_risk_score, calculate_approval_probability, get_form_questions as get_visa_form_questions

router = APIRouter()

# Document requirements by visa type
DOCUMENT_REQUIREMENTS = {
    "tourist": {
        "mandatory": ["passport", "photo", "bank_statement"],
        "optional": ["travel_insurance", "flight_itinerary"]
    },
    "business": {
        "mandatory": ["passport", "photo", "invitation_letter"],
        "optional": ["employment_letter", "bank_statement"]
    },
    "student": {
        "mandatory": ["passport", "photo", "invitation_letter", "bank_statement"],
        "optional": ["employment_letter"]
    },
    "work": {
        "mandatory": ["passport", "photo", "employment_letter", "invitation_letter"],
        "optional": ["bank_statement"]
    },
    "family_visit": {
        "mandatory": ["passport", "photo", "invitation_letter"],
        "optional": ["bank_statement", "employment_letter"]
    },
    "transit": {
        "mandatory": ["passport", "photo", "flight_itinerary"],
        "optional": []
    }
}

# New password verification model
from pydantic import BaseModel

class PasswordVerification(BaseModel):
    password: str

def hash_password(password: str) -> str:
    """Simple password hashing for demo (use proper hashing in production)"""
    return hashlib.sha256(password.encode()).hexdigest()

def check_document_requirements(application_id: str, visa_type: str, db: Session) -> dict:
    """Check if application meets document requirements"""
    requirements = DOCUMENT_REQUIREMENTS.get(visa_type, {"mandatory": [], "optional": []})
    
    # Get uploaded documents
    uploaded_docs = db.query(Document).filter(
        Document.application_id == application_id,
        Document.verified == True
    ).all()
    
    uploaded_types = [doc.type for doc in uploaded_docs]
    
    mandatory_missing = [doc_type for doc_type in requirements["mandatory"] 
                        if doc_type not in uploaded_types]
    
    return {
        "mandatory_required": requirements["mandatory"],
        "mandatory_uploaded": [doc for doc in uploaded_types if doc in requirements["mandatory"]],
        "mandatory_missing": mandatory_missing,
        "optional_available": requirements["optional"],
        "optional_uploaded": [doc for doc in uploaded_types if doc in requirements["optional"]],
        "requirements_met": len(mandatory_missing) == 0,
        "total_mandatory": len(requirements["mandatory"]),
        "total_mandatory_uploaded": len([doc for doc in uploaded_types if doc in requirements["mandatory"]])
    }

def determine_application_status(application_id: str, visa_type: str, db: Session) -> str:
    """Determine the correct application status based on documents and processing stage"""
    doc_status = check_document_requirements(application_id, visa_type, db)
    
    # Get current application
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return "submitted"
    
    current_status = app.status
    
    # If we're still in submitted status and documents aren't complete
    if current_status == "submitted" and not doc_status["requirements_met"]:
        return "document_collection"  # Special status for missing documents
    
    # If documents are now complete but we were in document_collection
    if current_status in ["submitted", "document_collection"] and doc_status["requirements_met"]:
        return "document_review"  # Move to next stage
    
    # Otherwise, keep current status
    return current_status

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
        
        # Check document requirements
        doc_status = check_document_requirements(app.id, app.visa_type, db)
        
        # Get document count
        doc_count = db.query(Document).filter(Document.application_id == app.id).count()
        
        # Determine actual status considering document requirements
        actual_status = determine_application_status(app.id, app.visa_type, db)
        
        app_data = ApplicationResponse(
            id=app.id,
            user_id=app.user_id,
            visa_type=app.visa_type,
            status=actual_status,
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
            estimated_days=get_estimated_days(actual_status, app.visa_type, doc_status["requirements_met"]),
            last_activity=app.updated_at,
            
            # Document status
            document_requirements=doc_status
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
    
    # Check document requirements
    doc_status = check_document_requirements(application_id, app.visa_type, db)
    actual_status = determine_application_status(application_id, app.visa_type, db)
    
    return ApplicationResponse(
        id=app.id,
        user_id=app.user_id,
        visa_type=app.visa_type,
        status=actual_status,
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
        estimated_days=get_estimated_days(actual_status, app.visa_type, doc_status["requirements_met"]),
        last_activity=app.updated_at,
        
        # Document status
        document_requirements=doc_status,
        
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

@router.post("/{application_id}/verify", response_model=ApplicationResponse)
async def verify_application_access(
    application_id: str, 
    verification: PasswordVerification, 
    db: Session = Depends(get_db)
):
    """Verify application access with password"""
    
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get stored password hash from application metadata
    answers = json.loads(app.answers) if app.answers else {}
    stored_password_hash = answers.get("access_password_hash")
    
    if not stored_password_hash:
        raise HTTPException(status_code=400, detail="Application does not have password protection")
    
    # Verify password
    provided_password_hash = hash_password(verification.password)
    if provided_password_hash != stored_password_hash:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Return application details if password is correct
    return await get_application(application_id, db)

@router.post("/", response_model=ApplicationResponse)
async def create_application(application_data: dict, db: Session = Depends(get_db)):
    """Create a new visa application - starts in document_collection status"""
    
    # Generate IDs
    app_id = generate_id("VSV")
    user_id = generate_id("user")
    
    # Extract data from request
    visa_type = application_data.get("visa_type")
    answers = application_data.get("answers", {})
    documents = application_data.get("documents", [])
    password = application_data.get("password")
    
    # Store password hash in answers if provided
    if password:
        answers["access_password_hash"] = hash_password(password)
    
    # Calculate risk score and approval probability
    risk_score = calculate_risk_score(visa_type, answers)
    approval_probability = calculate_approval_probability(risk_score, documents)
    
    # Create user (simplified for demo)
    user = User(
        id=user_id,
        email=answers.get("email", f"user{app_id[-6:]}@example.com"),
        name=answers.get("applicant_name", "Demo User"),
        phone=answers.get("phone", ""),
        nationality=answers.get("nationality", "")
    )
    db.add(user)
    
    # Check document requirements to determine initial status
    requirements = DOCUMENT_REQUIREMENTS.get(visa_type, {"mandatory": [], "optional": []})
    has_mandatory_docs = len(requirements["mandatory"]) == 0  # If no mandatory docs required
    
    initial_status = "submitted" if has_mandatory_docs else "document_collection"
    
    # Create application
    new_app = Application(
        id=app_id,
        user_id=user_id,
        visa_type=visa_type,
        status=initial_status,
        priority=get_priority_from_risk(risk_score),
        risk_score=risk_score,
        answers=json.dumps(answers),
        estimated_decision=datetime.utcnow() + timedelta(days=get_estimated_days(initial_status, visa_type, has_mandatory_docs)),
        approval_probability=approval_probability
    )
    db.add(new_app)
    
    # Create initial status update
    status_message = "Application submitted successfully"
    if not has_mandatory_docs:
        status_message += " - waiting for required documents to begin processing"
    
    status_update = StatusUpdate(
        id=generate_id("status"),
        application_id=app_id,
        status=initial_status,
        notes=status_message,
        timestamp=datetime.utcnow()
    )
    db.add(status_update)
    
    # Create documents (if any provided)
    for doc_data in documents:
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
    
    # Get document status for response
    doc_status = check_document_requirements(app_id, visa_type, db)
    
    return ApplicationResponse(
        id=new_app.id,
        user_id=new_app.user_id,
        visa_type=new_app.visa_type,
        status=initial_status,
        priority=new_app.priority,
        risk_score=new_app.risk_score,
        answers=json.loads(new_app.answers),
        submitted_at=new_app.submitted_at,
        updated_at=new_app.updated_at,
        estimated_decision=new_app.estimated_decision,
        approval_probability=new_app.approval_probability,
        assigned_officer_id=new_app.assigned_officer_id,
        
        applicant_name=answers.get("applicant_name", "Demo User"),
        country=answers.get("destination_country", "Unknown"),
        documents_count=len(documents),
        estimated_days=get_estimated_days(initial_status, visa_type, has_mandatory_docs),
        last_activity=new_app.updated_at,
        document_requirements=doc_status
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
    
    # Check document requirements before allowing status updates
    doc_status = check_document_requirements(application_id, app.visa_type, db)
    
    # Update fields
    if update.status:
        # Don't allow progression beyond document_collection if requirements not met
        if not doc_status["requirements_met"] and update.status not in ["document_collection", "rejected"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot update status to {update.status}: required documents not uploaded"
            )
        
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

@router.get("/{visa_type}/requirements")
async def get_document_requirements(visa_type: str):
    """Get document requirements for a visa type"""
    
    requirements = DOCUMENT_REQUIREMENTS.get(visa_type, {"mandatory": [], "optional": []})
    
    return {
        "visa_type": visa_type,
        "mandatory_documents": requirements["mandatory"],
        "optional_documents": requirements["optional"],
        "total_mandatory": len(requirements["mandatory"]),
        "total_optional": len(requirements["optional"])
    }

@router.post("/{application_id}/documents")
async def add_documents_to_application(
    application_id: str,
    documents: List[dict],
    db: Session = Depends(get_db)
):
    """Add documents to an existing application and update status if requirements met"""
    
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Add documents
    for doc_data in documents:
        document = Document(
            id=generate_id("doc"),
            application_id=application_id,
            name=doc_data.get("name", "Unknown Document"),
            type=doc_data.get("type", "unknown"),
            size=doc_data.get("size", 0),
            verified=doc_data.get("verified", False)
        )
        db.add(document)
    
    # Check if document requirements are now met
    doc_status = check_document_requirements(application_id, app.visa_type, db)
    
    # Update application status if requirements are now met
    old_status = app.status
    if doc_status["requirements_met"] and app.status == "document_collection":
        app.status = "document_review"
        
        # Create status update for progression
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=application_id,
            status="document_review",
            notes="All required documents uploaded - processing can now continue",
            timestamp=datetime.utcnow()
        )
        db.add(status_update)
    
    # Create status update for document addition
    status_update = StatusUpdate(
        id=generate_id("status"),
        application_id=application_id,
        status=app.status,
        notes=f"Added {len(documents)} supporting documents",
        timestamp=datetime.utcnow()
    )
    db.add(status_update)
    
    # Update last activity
    app.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": f"Added {len(documents)} documents to application {application_id}",
        "requirements_met": doc_status["requirements_met"],
        "status_changed": old_status != app.status,
        "new_status": app.status,
        "document_status": doc_status
    }

# Utility functions
def get_estimated_days(status: str, visa_type: str, requirements_met: bool = True) -> int:
    """Calculate estimated processing days based on status, visa type, and document status"""
    
    # If requirements not met, processing hasn't started
    if not requirements_met:
        return 0
    
    base_days = {
        "tourist": 7,
        "business": 10,
        "student": 21,
        "work": 30,
        "family_visit": 14,
        "transit": 3
    }
    
    status_multipliers = {
        "document_collection": 0,  # No processing until docs uploaded
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