# app/backend/routes/documents.py - Real document upload implementation
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
import os
import mimetypes
import shutil
from typing import List
from pathlib import Path
from database import get_db, Document as DocumentDB, Application
from models import DocumentResponse
from utils import generate_id

router = APIRouter()

# Document requirements by visa type
DOCUMENT_REQUIREMENTS = {
    "tourist": {
        "mandatory": ["passport", "bank_statement"],
        "optional": ["travel_insurance", "flight_itinerary", "invitation_letter"]
    },
    "business": {
        "mandatory": ["passport", "invitation_letter"],
        "optional": ["employment_letter", "bank_statement"]
    },
    "student": {
        "mandatory": ["passport", "invitation_letter", "bank_statement"],
        "optional": ["employment_letter"]
    },
    "work": {
        "mandatory": ["passport", "employment_letter", "invitation_letter"],
        "optional": ["bank_statement"]
    },
    "family_visit": {
        "mandatory": ["passport", "invitation_letter"],
        "optional": ["bank_statement", "employment_letter"]
    },
    "transit": {
        "mandatory": ["passport", "flight_itinerary"],
        "optional": []
    }
}

# Maximum file size (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size (we'll check this when reading)
    # Note: file.size might not be available, so we'll check during read

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal"""
    # Remove any path components and keep only the filename
    clean_name = os.path.basename(filename)
    # Replace any remaining problematic characters
    clean_name = "".join(c for c in clean_name if c.isalnum() or c in ".-_")
    return clean_name

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    application_id: str = Form(...),
    document_type: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload a document file for an application"""
    
    # Validate file
    validate_file(file)
    
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Create organized directory structure
    app_uploads_dir = Path("uploads") / application_id
    app_uploads_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate safe filename
    original_filename = file.filename
    file_ext = Path(original_filename).suffix.lower()
    safe_filename = f"{document_type}{file_ext}"
    
    file_path = app_uploads_dir / safe_filename
    
    try:
        # Read and validate file size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Write file to disk
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Simple document verification (in real app, this would be more sophisticated)
        verified = verify_document_content(content, document_type, file_ext)
        
        # Check if document already exists for this application and type
        existing_doc = db.query(DocumentDB).filter(
            DocumentDB.application_id == application_id,
            DocumentDB.type == document_type
        ).first()
        
        if existing_doc:
            # Update existing document
            existing_doc.name = safe_filename
            existing_doc.size = len(content)
            existing_doc.verified = verified
            existing_doc.file_path = f"uploads/{application_id}/{safe_filename}"
            document = existing_doc
        else:
            # Create new document record
            document = DocumentDB(
                id=generate_id("doc"),
                application_id=application_id,
                name=safe_filename,
                type=document_type,
                size=len(content),
                verified=verified,
                file_path=f"uploads/{application_id}/{safe_filename}"
            )
            db.add(document)
        
        db.commit()
        db.refresh(document)
        
        print(f"✅ Uploaded document: {file_path} ({len(content)} bytes, verified: {verified})")
        
        return DocumentResponse(
            id=document.id,
            name=document.name,
            type=document.type,
            size=document.size,
            verified=document.verified,
            uploaded_at=document.uploaded_at,
            file_path=document.file_path
        )
        
    except Exception as e:
        # Clean up file if database operation failed
        if file_path.exists():
            file_path.unlink()
        
        if isinstance(e, HTTPException):
            raise e
        
        print(f"❌ Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

def verify_document_content(content: bytes, doc_type: str, file_ext: str) -> bool:
    """Placeholder verification always returns True (simplified cleanup)."""
    return True

@router.get("/{visa_type}/requirements")
async def get_document_requirements_for_visa_type(visa_type: str):
    """Get document requirements for a specific visa type"""
    
    requirements = DOCUMENT_REQUIREMENTS.get(visa_type, DOCUMENT_REQUIREMENTS["tourist"])
    
    return {
        "visa_type": visa_type,
        "mandatory_documents": requirements["mandatory"],
        "optional_documents": requirements["optional"],
        "total_mandatory": len(requirements["mandatory"]),
        "total_optional": len(requirements["optional"])
    }

@router.get("/view/{application_id}/{document_name}")
async def view_document_by_name(application_id: str, document_name: str):
    """Serve a document file for viewing from organized structure with debugging"""
    
    # Construct path to organized document
    file_path = Path("uploads") / application_id / document_name
    
    print(f"🔍 Looking for document: {file_path}")
    print(f"📁 File exists: {file_path.exists()}")
    
    if not file_path.exists():
        print(f"❌ Document not found at: {file_path}")
        
        # List what files ARE in the directory for debugging
        app_dir = Path("uploads") / application_id
        if app_dir.exists():
            print(f"📂 Files in {app_dir}:")
            for existing_file in app_dir.iterdir():
                print(f"   - {existing_file.name}")
        else:
            print(f"📂 Directory {app_dir} does not exist")
        
        raise HTTPException(status_code=404, detail=f"Document not found: {document_name}")
    
    # Determine media type based on file extension
    import mimetypes
    media_type, _ = mimetypes.guess_type(str(file_path))
    if not media_type:
        if str(file_path).lower().endswith('.pdf'):
            media_type = 'application/pdf'
        elif str(file_path).lower().endswith(('.jpg', '.jpeg')):
            media_type = 'image/jpeg'
        elif str(file_path).lower().endswith('.png'):
            media_type = 'image/png'
        else:
            media_type = 'application/octet-stream'
    
    print(f"📄 Serving {file_path} as {media_type}")
    
    # Create response with proper headers for CORS
    response = FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=document_name,
    )
    
    # Add CORS headers manually
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Content-Disposition"] = f"inline; filename={document_name}"
    response.headers["Cache-Control"] = "no-cache"
    
    return response

@router.get("/download/{application_id}/{document_name}")
async def download_document_by_name(application_id: str, document_name: str):
    """Download a document file from organized structure"""
    
    # Construct path to organized document
    file_path = Path("uploads") / application_id / document_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create response with download headers
    response = FileResponse(
        path=str(file_path),
        filename=document_name,
    )
    
    # Add CORS headers manually
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Content-Disposition"] = f"attachment; filename={document_name}"
    
    return response

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

@router.get("/list/{application_id}")
async def list_application_documents(application_id: str, db: Session = Depends(get_db)):
    """List all documents for an application with view URLs from organized structure"""
    
    documents = db.query(DocumentDB).filter(
        DocumentDB.application_id == application_id
    ).all()
    
    result = []
    for doc in documents:
        # Check if file exists in organized structure
        organized_file_path = Path("uploads") / application_id / doc.name
        file_exists = organized_file_path.exists()
        
        result.append({
            "id": doc.id,
            "name": doc.name,
            "type": doc.type,
            "size": doc.size,
            "verified": doc.verified,
            "uploaded_at": doc.uploaded_at.isoformat(),
            "view_url": f"/api/documents/view/{application_id}/{doc.name}" if file_exists else None,
            "download_url": f"/api/documents/download/{application_id}/{doc.name}" if file_exists else None,
            "file_exists": file_exists,
            "file_path": f"uploads/{application_id}/{doc.name}" if file_exists else None
        })
    
    return result

@router.get("/files/{application_id}")
async def list_physical_files(application_id: str):
    """List actual files in the organized uploads directory"""
    
    app_dir = Path("uploads") / application_id
    
    if not app_dir.exists():
        return {
            "application_id": application_id,
            "directory_exists": False,
            "files": []
        }
    
    files = []
    for file_path in app_dir.iterdir():
        if file_path.is_file():
            # Determine document type from filename
            doc_type = "unknown"
            filename_lower = file_path.name.lower()
            
            if "passport" in filename_lower:
                doc_type = "passport"
            elif "bank" in filename_lower:
                doc_type = "bank_statement"
            elif "invitation" in filename_lower:
                doc_type = "invitation_letter"
            elif "employment" in filename_lower:
                doc_type = "employment_letter"
            elif "insurance" in filename_lower:
                doc_type = "travel_insurance"
            elif "flight" in filename_lower or "itinerary" in filename_lower:
                doc_type = "flight_itinerary"
            
            files.append({
                "name": file_path.name,
                "type": doc_type,
                "size": file_path.stat().st_size,
                "view_url": f"/api/documents/view/{application_id}/{file_path.name}",
                "download_url": f"/api/documents/download/{application_id}/{file_path.name}"
            })
    
    return {
        "application_id": application_id,
        "directory_exists": True,
        "files": files,
        "total_files": len(files)
    }

@router.put("/{document_id}/verify")
async def verify_document(document_id: str, verified: bool, db: Session = Depends(get_db)):
    """Mark a document as verified or not verified"""
    
    document = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.verified = verified
    db.commit()
    
    return {"message": f"Document {'verified' if verified else 'marked as unverified'}"}

@router.delete("/{application_id}/{document_type}")
async def delete_document(application_id: str, document_type: str, db: Session = Depends(get_db)):
    """Delete a document from an application"""
    
    # Find document in database
    document = db.query(DocumentDB).filter(
        DocumentDB.application_id == application_id,
        DocumentDB.type == document_type
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete physical file
    file_path = Path("uploads") / application_id / document.name
    if file_path.exists():
        file_path.unlink()
    
    # Delete database record
    db.delete(document)
    db.commit()
    
    return {"message": f"Document {document_type} deleted successfully"}

# Removed explicit OPTIONS handlers; relying on global CORS middleware