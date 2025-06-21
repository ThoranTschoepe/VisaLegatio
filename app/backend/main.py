# backend/main.py - FastAPI main application

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from contextlib import asynccontextmanager

from database import engine, create_tables, get_db
from models import *
from routes import applications, chat, officers, analytics, documents
from utils import seed_demo_data

# Startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting VisaVerge Backend...")
    create_tables()
    seed_demo_data()
    print("✅ Database initialized and seeded!")
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
        "embassy": "AI-Powered Visa Processing"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "🏛️ Welcome to VisaVerge API",
        "docs": "/api/docs",
        "health": "/api/health",
        "frontend": "http://localhost:3000"
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