# backend/main.py - FastAPI main application with auto database reset

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from contextlib import asynccontextmanager

from database import engine, create_tables, get_db
from models import *
from routes import applications, chat, officers, analytics, documents
from utils import seed_demo_data

def reset_database():
    """Reset database by deleting the file and recreating everything"""
    db_file = "visaverge.db"
    uploads_dir = "uploads"
    
    try:
        # Remove existing database file
        if os.path.exists(db_file):
            os.remove(db_file)
            print(f"🗑️  Deleted existing database: {db_file}")
        
        # Remove and recreate uploads directory
        if os.path.exists(uploads_dir):
            import shutil
            shutil.rmtree(uploads_dir)
            print(f"🗑️  Deleted existing uploads directory")
        
        os.makedirs(uploads_dir, exist_ok=True)
        print(f"📁 Created fresh uploads directory")
        
        # Recreate database and seed with demo data
        create_tables()
        print("🏗️  Created fresh database tables")
        
        seed_demo_data()
        print("🌱 Seeded fresh demo data")
        
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        raise

# Startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting VisaVerge Backend...")
    print("🔄 Resetting database for fresh demo environment...")
    
    reset_database()
    
    print("✅ Database reset and initialized with fresh demo data!")
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
    
    yield
    
    # Shutdown
    print("👋 Shutting down VisaVerge Backend...")

# Create FastAPI app
app = FastAPI(
    title="VisaVerge API",
    description="AI-Powered Visa Application System - Embassy Innovation Hackathon",
    version="1.0.0",
    docs_url="/api/docs",  # Swagger UI
    redoc_url="/api/redoc", # ReDoc
    lifespan=lifespan
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for document uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include API routes
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(officers.router, prefix="/api/officers", tags=["Officers"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "VisaVerge Backend",
        "version": "1.0.0",
        "embassy": "AI-Powered Visa Processing",
        "database": "Fresh reset on startup"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "🏛️ Welcome to VisaVerge API",
        "docs": "/api/docs",
        "health": "/api/health",
        "frontend": "http://localhost:3000",
        "status": "Database reset on startup - ready for demo"
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