

# backend/routes/documents.py - Document handling API

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
import shutil
from typing import List

from database import get_db, Document as DocumentDB, Application
from models import DocumentResponse, DocumentUpload
from utils import generate_id

router = APIRouter()

@router.post("/upload")
async def upload_document(
    application_id: str,
    document_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a document for an application"""
    
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Create uploads directory if it doesn't exist
    os.makedirs("uploads", exist_ok=True)
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{generate_id('doc')}{file_extension}"
    file_path = os.path.join("uploads", filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create document record
    document = DocumentDB(
        id=generate_id("doc"),
        application_id=application_id,
        name=file.filename,
        type=document_type,
        size=file.size,
        verified=False,  # Will be verified later
        file_path=file_path
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return DocumentResponse(
        id=document.id,
        name=document.name,
        type=document.type,
        size=document.size,
        verified=document.verified,
        uploaded_at=document.uploaded_at,
        file_path=document.file_path
    )

@router.get("/application/{application_id}", response_model=List[DocumentResponse])
async def get_documents_by_application(application_id: str, db: Session = Depends(get_db)):
    """Get all documents for an application"""
    
    documents = db.query(DocumentDB).filter(
        DocumentDB.application_id == application_id
    ).all()
    
    return [
        DocumentResponse(
            id=doc.id,
            name=doc.name,
            type=doc.type,
            size=doc.size,
            verified=doc.verified,
            uploaded_at=doc.uploaded_at,
            file_path=doc.file_path
        )
        for doc in documents
    ]

@router.put("/{document_id}/verify")
async def verify_document(document_id: str, verified: bool, db: Session = Depends(get_db)):
    """Mark a document as verified or not verified"""
    
    document = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.verified = verified
    db.commit()
    
    return {"message": f"Document {'verified' if verified else 'marked as unverified'}"}
