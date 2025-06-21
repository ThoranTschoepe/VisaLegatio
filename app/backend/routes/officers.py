# backend/routes/officers.py - Officers authentication API

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, Officer
from models import OfficerLogin, OfficerResponse

router = APIRouter()

@router.post("/login", response_model=OfficerResponse)
async def officer_login(credentials: OfficerLogin, db: Session = Depends(get_db)):
    """Authenticate embassy officer"""
    
    officer = db.query(Officer).filter(
        Officer.id == credentials.officer_id,
        Officer.password_hash == credentials.password  # In real app, use proper password hashing
    ).first()
    
    if not officer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return OfficerResponse(
        id=officer.id,
        name=officer.name,
        email=officer.email,
        role=officer.role,
        embassy_id=officer.embassy_id,
        created_at=officer.created_at
    )

@router.get("/profile/{officer_id}", response_model=OfficerResponse)
async def get_officer_profile(officer_id: str, db: Session = Depends(get_db)):
    """Get officer profile information"""
    
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    return OfficerResponse(
        id=officer.id,
        name=officer.name,
        email=officer.email,
        role=officer.role,
        embassy_id=officer.embassy_id,
        created_at=officer.created_at
    )