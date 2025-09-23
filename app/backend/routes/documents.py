from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import hashlib
import uuid
from typing import List
from pathlib import Path
from datetime import datetime

try:
    import aiofiles  # type: ignore
except ImportError:  # pragma: no cover - fallback for test environments without aiofiles
    aiofiles = None
import json
from database import get_db, Document as DocumentDB, Application, DocumentAnalysis
from models import DocumentResponse, DocumentAnalysisResponse, DocumentClassificationResponse, ExtractedDataResponse, DetectedProblemResponse, ProblemSeverity
from services.document_ai_service import document_ai_service
from utils import generate_id

router = APIRouter()

async def process_ai_analysis_background(
    file_path: Path, 
    document_type: str, 
    document_id: str,
    application_context: dict,
    retry_count: int = 0,
    max_retries: int = 3
):
    """Background task to perform AI analysis for officer review only with retry logic"""
    if not document_ai_service.enabled:
        print("ℹ️ AI analysis disabled - skipping background processing")
        return
        
    try:
        print(f"🤖 [Background] Starting AI analysis for {document_type} (doc_id: {document_id}, attempt: {retry_count + 1}/{max_retries + 1})...")
        
        ai_analysis = await document_ai_service.analyze_document(
            file_path,
            document_type,
            application_context
        )
        
        if ai_analysis:
            print(f"✅ [Background] AI analysis completed in {ai_analysis.processing_time_ms}ms")
            
            # Store AI analysis in database for officer review
            from database import SessionLocal
            db = SessionLocal()
            try:
                analysis_record = DocumentAnalysis(
                    id=generate_id("analysis"),
                    document_id=document_id,
                    detected_document_type=ai_analysis.classification.document_type,
                    classification_confidence=ai_analysis.classification.confidence,
                    is_correct_type=ai_analysis.classification.is_correct_type,
                    extracted_text=ai_analysis.extracted_data.text_content,
                    detected_dates=json.dumps(ai_analysis.extracted_data.dates),
                    detected_amounts=json.dumps(ai_analysis.extracted_data.amounts),
                    detected_names=json.dumps(ai_analysis.extracted_data.names),
                    problems_detected=json.dumps([{
                        "problem_type": p.problem_type,
                        "severity": p.severity,
                        "description": p.description,
                        "suggestion": p.suggestion
                    } for p in ai_analysis.problems]),
                    overall_confidence=ai_analysis.overall_confidence,
                    is_authentic=ai_analysis.is_authentic,
                    processing_time_ms=ai_analysis.processing_time_ms,
                    ai_model_version="gemini-2.5-flash"
                )
                
                db.add(analysis_record)
                db.commit()
                print(f"💾 [Background] AI analysis stored for officer review")
                print(f"📊 [Background] Confidence: {ai_analysis.overall_confidence:.2f}, Issues: {len(ai_analysis.problems)}")
                
            finally:
                db.close()
        else:
            print("⚠️ [Background] AI analysis failed - no result returned")
            
    except Exception as e:
        error_message = str(e)
        print(f"❌ [Background] AI analysis failed: {error_message}")
        
        # Check if it's a retryable error (503 overload, network issues, etc.)
        should_retry = (
            "503" in error_message or 
            "overloaded" in error_message.lower() or
            "unavailable" in error_message.lower() or
            "timeout" in error_message.lower() or
            "network" in error_message.lower()
        )
        
        if should_retry and retry_count < max_retries:
            # Exponential backoff: 2^retry_count * 5 seconds (5s, 10s, 20s)
            delay = (2 ** retry_count) * 5
            print(f"🔄 [Background] Retrying AI analysis in {delay} seconds (attempt {retry_count + 2}/{max_retries + 1})...")
            
            # Schedule retry as a background task with delay
            import asyncio
            from fastapi import BackgroundTasks
            await asyncio.sleep(delay)
            await process_ai_analysis_background(
                file_path, document_type, document_id, application_context, 
                retry_count + 1, max_retries
            )
        else:
            if retry_count >= max_retries:
                print(f"💀 [Background] AI analysis failed after {max_retries + 1} attempts - giving up")
            else:
                print(f"💀 [Background] AI analysis failed with non-retryable error - giving up")

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

# File upload configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_SIZE = 1024 * 1024  # 1MB chunks for streaming
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
}

# Magic library is optional - will use basic validation if not available
mime_detector = None

async def validate_file_headers(file_content: bytes, filename: str) -> tuple[bool, str]:
    """Validate file headers to ensure file type matches extension"""
    file_ext = Path(filename).suffix.lower()
    
    # Check magic bytes for common file types
    if len(file_content) < 8:
        return False, "File too small to be valid"
    
    # PDF magic bytes
    if file_ext == '.pdf':
        if not file_content.startswith(b'%PDF'):
            return False, "Invalid PDF file"
    
    # JPEG magic bytes
    elif file_ext in ['.jpg', '.jpeg']:
        if not (file_content.startswith(b'\xff\xd8\xff')):
            return False, "Invalid JPEG file"
    
    # PNG magic bytes
    elif file_ext == '.png':
        if not file_content.startswith(b'\x89PNG\r\n\x1a\n'):
            return False, "Invalid PNG file"
    
    # Use python-magic if available for additional validation
    if mime_detector:
        try:
            detected_mime = mime_detector.from_buffer(file_content[:2048])
            if detected_mime not in ALLOWED_MIME_TYPES:
                return False, f"File content type {detected_mime} not allowed"
        except Exception as e:
            print(f"Warning: Could not detect MIME type: {e}")
    
    return True, "Valid"

def validate_file_metadata(file: UploadFile) -> None:
    """Validate uploaded file metadata"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validate content type if provided
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        # Don't fail on content_type mismatch as browsers can be unreliable
        print(f"⚠️ Warning: Unexpected content type {file.content_type} for {file.filename}")

def generate_safe_filename(original_filename: str, document_type: str) -> str:
    """Generate a safe, unique filename"""
    file_ext = Path(original_filename).suffix.lower()
    # Use UUID to ensure uniqueness
    unique_id = str(uuid.uuid4())[:8]
    safe_filename = f"{document_type}_{unique_id}{file_ext}"
    return safe_filename

def calculate_file_hash(content: bytes) -> str:
    """Calculate SHA256 hash of file content"""
    return hashlib.sha256(content).hexdigest()

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    application_id: str = Form(...),
    document_type: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload a document file with enhanced validation and error handling"""
    
    # Validate file metadata
    validate_file_metadata(file)
    
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Create organized directory structure
    app_uploads_dir = Path("uploads") / application_id
    app_uploads_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate safe, unique filename
    safe_filename = generate_safe_filename(file.filename, document_type)
    file_path = app_uploads_dir / safe_filename
    temp_file_path = file_path.with_suffix('.tmp')
    
    try:
        # Stream file to disk to handle large files efficiently
        total_size = 0
        file_hash = hashlib.sha256()
        
        # First pass: write to temp file and validate
        if aiofiles:
            async with aiofiles.open(temp_file_path, 'wb') as f:
                while chunk := await file.read(CHUNK_SIZE):
                    total_size += len(chunk)

                    if total_size > MAX_FILE_SIZE:
                        await f.close()
                        temp_file_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=413,
                            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
                        )

                    file_hash.update(chunk)
                    await f.write(chunk)
            async with aiofiles.open(temp_file_path, 'rb') as f:
                first_chunk = await f.read(8192)
        else:
            chunks: list[bytes] = []
            while chunk := await file.read(CHUNK_SIZE):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    temp_file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
                    )
                file_hash.update(chunk)
                chunks.append(chunk)

            with open(temp_file_path, 'wb') as f:
                for chunk in chunks:
                    f.write(chunk)

            with open(temp_file_path, 'rb') as f:
                first_chunk = f.read(8192)
        
        # Validate file content matches extension
        is_valid, validation_message = await validate_file_headers(first_chunk, file.filename)
        if not is_valid:
            temp_file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=validation_message)
        
        # Move temp file to final location
        temp_file_path.rename(file_path)
        
        # Calculate file hash for integrity
        file_hash_hex = file_hash.hexdigest()
        
        # Use basic verification only - AI analysis will run in background for officers
        verified = verify_document_content(first_chunk, document_type, Path(file.filename).suffix.lower())
        
        print(f"📊 Basic verification completed - AI analysis will be performed in background for officer review")
        
        # Check if document already exists for this application and type
        existing_doc = db.query(DocumentDB).filter(
            DocumentDB.application_id == application_id,
            DocumentDB.type == document_type
        ).first()
        
        # If exists, delete old file
        if existing_doc and existing_doc.file_path:
            old_file = Path(existing_doc.file_path)
            if old_file.exists() and old_file != file_path:
                old_file.unlink(missing_ok=True)
        
        if existing_doc:
            # Update existing document
            existing_doc.name = safe_filename
            existing_doc.size = total_size
            existing_doc.verified = verified
            existing_doc.file_path = str(file_path)
            document = existing_doc
        else:
            # Create new document record
            document = DocumentDB(
                id=generate_id("doc"),
                application_id=application_id,
                name=safe_filename,
                type=document_type,
                size=total_size,
                verified=verified,
                file_path=str(file_path)
            )
            db.add(document)
        
        db.commit()
        db.refresh(document)
        
        # Schedule AI analysis as background task for officer review only
        # Extract application context for AI analysis
        applicant_name = "Unknown"
        destination_country = "Germany"  # Default
        purpose_of_travel = application.visa_type
        
        try:
            import json
            if application.answers:
                answers = json.loads(application.answers) if isinstance(application.answers, str) else application.answers
                applicant_name = answers.get('applicant_name') or answers.get('full_name') or "Unknown"
                destination_country = answers.get('destination_country') or answers.get('country') or "Germany"
                purpose_of_travel = answers.get('purpose_of_travel') or answers.get('travel_purpose') or application.visa_type
        except Exception as e:
            print(f"⚠️ Could not extract application context from answers: {e}")
        
        background_tasks.add_task(
            process_ai_analysis_background,
            file_path,
            document_type, 
            document.id,
            {
                "application_id": application_id, 
                "visa_type": application.visa_type,
                "applicant_name": applicant_name,
                "destination_country": destination_country,
                "purpose_of_travel": purpose_of_travel
            }
        )
        
        print(f"✅ Uploaded: {safe_filename} ({total_size:,} bytes, hash: {file_hash_hex[:8]}..., verified: {verified})")
        print(f"🔄 AI analysis scheduled for background processing (officer review only)")
        print(f"📤 Upload response sent immediately to frontend - AI analysis runs separately")
        
        # Create response without AI analysis (not visible to applicants)
        response_data = {
            "id": document.id,
            "name": document.name,
            "type": document.type,
            "size": document.size,
            "verified": document.verified,
            "uploaded_at": document.uploaded_at,
            "file_path": document.file_path
        }
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Clean up files on error
        temp_file_path.unlink(missing_ok=True)
        file_path.unlink(missing_ok=True)
        
        print(f"❌ Upload error: {type(e).__name__}: {e}")
        
        # Provide user-friendly error messages
        if "No space left" in str(e):
            raise HTTPException(status_code=507, detail="Server storage full. Please try again later.")
        elif "Permission denied" in str(e):
            raise HTTPException(status_code=500, detail="Server configuration error. Please contact support.")
        else:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

def verify_document_content(content: bytes, doc_type: str, file_ext: str) -> bool:
    """Enhanced document verification with basic content checks"""
    
    # Check if file has minimum content
    if len(content) < 100:
        return False
    
    # PDF specific checks
    if file_ext == '.pdf':
        # Check for PDF structure markers
        if b'%PDF' not in content[:10]:
            return False
        # Could add more PDF validation here
    
    # Image specific checks
    elif file_ext in ['.jpg', '.jpeg', '.png']:
        # Basic image validation already done in validate_file_headers
        # Could add dimension checks, etc.
        pass
    
    # Document type specific validation
    if doc_type == 'passport':
        # In production, could use OCR to verify passport fields
        pass
    elif doc_type == 'bank_statement':
        # Could check for bank-related keywords in PDFs
        pass
    
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
        
        # Get AI analysis if available (for officer review)
        ai_analysis = db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == doc.id).first()
        ai_analysis_data = None
        
        if ai_analysis:
            try:
                problems = json.loads(ai_analysis.problems_detected) if ai_analysis.problems_detected else []
                ai_analysis_data = {
                    "classification": {
                        "document_type": ai_analysis.detected_document_type,
                        "confidence": ai_analysis.classification_confidence,
                        "is_correct_type": ai_analysis.is_correct_type
                    },
                    "extracted_data": {
                        "text_content": ai_analysis.extracted_text[:500] if ai_analysis.extracted_text else "",
                        "dates": json.loads(ai_analysis.detected_dates) if ai_analysis.detected_dates else [],
                        "amounts": json.loads(ai_analysis.detected_amounts) if ai_analysis.detected_amounts else [],
                        "names": json.loads(ai_analysis.detected_names) if ai_analysis.detected_names else []
                    },
                    "problems": problems,
                    "overall_confidence": ai_analysis.overall_confidence,
                    "is_authentic": ai_analysis.is_authentic,
                    "processing_time_ms": ai_analysis.processing_time_ms,
                    "analyzed_at": ai_analysis.analyzed_at.isoformat() if ai_analysis.analyzed_at else None,
                    "ai_model_version": ai_analysis.ai_model_version
                }
            except Exception as e:
                print(f"⚠️ Error parsing AI analysis for document {doc.id}: {e}")
        
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
            "file_path": f"uploads/{application_id}/{doc.name}" if file_exists else None,
            "ai_analysis": ai_analysis_data  # Only visible to officers
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
    
    # Delete associated AI analysis records first to avoid foreign key constraint issues
    ai_analysis = db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == document.id).first()
    if ai_analysis:
        db.delete(ai_analysis)
        print(f"🗑️ Deleted AI analysis for document: {document.name}")
    
    # Delete database record
    db.delete(document)
    db.commit()
    
    return {"message": f"Document {document_type} deleted successfully"}

# Removed explicit OPTIONS handlers; relying on global CORS middleware
