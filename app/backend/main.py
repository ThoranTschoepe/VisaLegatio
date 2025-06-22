# backend/main.py - Updated with real file upload support
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os
from contextlib import asynccontextmanager
from pathlib import Path
from database import engine, create_tables, get_db
from models import *
from routes import applications, chat, officers, analytics, documents, bias_review
from utils import seed_demo_data

def reset_database_and_create_organized_docs():
    """Reset database and create organized document structure"""
    db_file = "visaverge.db"
    uploads_dir = Path("uploads")
    
    try:
        # Remove existing database file
        if os.path.exists(db_file):
            os.remove(db_file)
            print(f"🗑️  Deleted existing database: {db_file}")
        
        # Remove and recreate uploads directory
        if uploads_dir.exists():
            import shutil
            shutil.rmtree(uploads_dir)
            print(f"🗑️  Deleted existing uploads directory")
        
        uploads_dir.mkdir(exist_ok=True)
        print(f"📁 Created fresh uploads directory")
        
        # Recreate database and seed with organized data
        create_tables()
        print("🏗️  Created fresh database tables")
        
        seed_demo_data()
        print("🌱 Seeded fresh demo data with organized documents")
        
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        raise

# Startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting VisaLegatio Backend...")
    print("🔄 Resetting database and creating organized document structure...")
    
    reset_database_and_create_organized_docs()
    
    print("✅ Database reset and initialized with organized documents!")
    print("📋 Demo Application Credentials:")
    print("   🏢 VSV-240101-A1B2 / DEMO123 (Business - Sarah Johnson)")
    print("   🏖️  VSV-240102-C3D4 / DEMO456 (Tourist - Miguel Rodriguez)")
    print("   🎓 VSV-240103-E5F6 / DEMO789 (Student - Anna Chen)")
    print("   💼 VSV-240104-G7H8 / DEMO999 (Work - James Wilson)")
    print("👮 Embassy Officer Credentials:")
    print("   🔐 maria.schmidt / demo123 (Senior Officer)")
    print("   🔐 john.davis / demo123 (Standard Officer)")
    print("   🔐 admin / admin (Administrator)")
    print("🌐 Frontend: http://localhost:3000")
    print("📚 API Docs: http://localhost:8000/api/docs")
    print("📁 File Upload: Real upload to /uploads/[application_id]/[filename]")
    print("🔗 Document Access: /api/documents/view/[application_id]/[filename]")
    
    yield
    
    # Shutdown
    print("👋 Shutting down VisaLegatio Backend...")

# Create FastAPI app
app = FastAPI(
    title="VisaLegatio API",
    description="AI-Powered Visa Application System with Real File Upload - Embassy Innovation Hackathon",
    version="1.0.0",
    docs_url="/api/docs",  # Swagger UI
    redoc_url="/api/redoc", # ReDoc
    lifespan=lifespan
)

# Enhanced CORS middleware for frontend integration + file uploads
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Ensure uploads directory exists
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Mount static files for document uploads with organized structure
class CORSStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        
        # Add CORS headers to static file responses
        if hasattr(response, 'headers'):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
        
        return response

# Mount the uploads directory for static file serving
app.mount("/uploads", CORSStaticFiles(directory="uploads"), name="uploads")

# Include API routes with proper prefixes
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(officers.router, prefix="/api/officers", tags=["Officers"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(bias_review.router, prefix="/api/bias-review", tags=["Bias Review"])

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "VisaLegatio Backend",
        "version": "1.0.0",
        "embassy": "AI-Powered Visa Processing",
        "database": "Fresh reset on startup",
        "uploads_dir": str(uploads_dir.absolute()),
        "uploads_exists": uploads_dir.exists(),
        "document_structure": "Organized by application ID",
        "file_upload": "Real upload endpoint available at /api/documents/upload",
        "max_file_size": "10MB",
        "supported_formats": ["PDF", "JPG", "JPEG", "PNG"]
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "🏛️ Welcome to VisaLegatio API with Real File Upload",
        "docs": "/api/docs",
        "health": "/api/health",
        "frontend": "http://localhost:3000",
        "status": "Database reset on startup - ready for demo",
        "file_upload": {
            "endpoint": "/api/documents/upload",
            "method": "POST",
            "format": "multipart/form-data",
            "fields": ["file", "application_id", "document_type"],
            "max_size": "10MB",
            "supported_types": ["PDF", "JPG", "JPEG", "PNG"]
        },
        "document_access": {
            "view": "/api/documents/view/[application_id]/[filename]",
            "download": "/api/documents/download/[application_id]/[filename]",
            "list": "/api/documents/list/[application_id]"
        },
        "demo_applications": [
            "VSV-240101-A1B2 (Business - Complete docs)",
            "VSV-240102-C3D4 (Tourist - Partial docs)", 
            "VSV-240103-E5F6 (Student - Complete docs)",
            "VSV-240104-G7H8 (Work - Minimal docs)"
        ]
    }

# Handle CORS preflight requests for all routes
@app.options("/{path:path}")
async def handle_options(path: str):
    """Handle CORS preflight requests"""
    from fastapi.responses import Response
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Serve organized documents directly via API (alternative to static mount)
@app.get("/api/files/{application_id}/{filename}")
async def serve_organized_document(application_id: str, filename: str):
    """Serve documents from organized structure with proper headers"""
    
    file_path = uploads_dir / application_id / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Document not found: {filename}")
    
    # Determine media type
    import mimetypes
    media_type, _ = mimetypes.guess_type(str(file_path))
    if not media_type:
        if filename.lower().endswith('.pdf'):
            media_type = 'application/pdf'
        elif filename.lower().endswith(('.jpg', '.jpeg')):
            media_type = 'image/jpeg'
        elif filename.lower().endswith('.png'):
            media_type = 'image/png'
        else:
            media_type = 'application/octet-stream'
    
    response = FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )
    
    # Add CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Content-Disposition"] = f"inline; filename={filename}"
    
    return response

# Debug endpoint to list all organized files
@app.get("/api/debug/files")
async def debug_list_all_files():
    """Debug endpoint to list all files in organized structure"""
    
    files_by_app = {}
    
    for app_dir in uploads_dir.iterdir():
        if app_dir.is_dir():
            app_id = app_dir.name
            files = []
            
            for file_path in app_dir.iterdir():
                if file_path.is_file():
                    files.append({
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "url": f"/uploads/{app_id}/{file_path.name}",
                        "api_url": f"/api/documents/view/{app_id}/{file_path.name}",
                        "upload_time": file_path.stat().st_mtime
                    })
            
            files_by_app[app_id] = files
    
    return {
        "uploads_directory": str(uploads_dir.absolute()),
        "organized_structure": files_by_app,
        "total_applications": len(files_by_app),
        "total_files": sum(len(files) for files in files_by_app.values()),
        "upload_endpoint": "/api/documents/upload",
        "instructions": {
            "static_access": "http://localhost:8000/uploads/[app_id]/[filename]",
            "api_access": "http://localhost:8000/api/documents/view/[app_id]/[filename]",
            "upload": "POST to /api/documents/upload with multipart/form-data"
        }
    }

# Development server
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload for development
        log_level="info"
    )