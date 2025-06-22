# backend/routes/bias_review.py - AI Bias Review API

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List, Optional
import random
import json

from database import get_db, Application, StatusUpdate, Officer
from models import ApplicationResponse
from utils import generate_id

router = APIRouter()

# Store bias reviews in memory for demo (in production, use a proper table)
bias_reviews = {}

@router.get("/sample")
async def get_bias_review_sample(
    sample_rate: float = Query(0.1, description="Percentage of rejections to sample"),
    days_back: int = Query(30, description="Days to look back for rejections"),
    db: Session = Depends(get_db)
):
    """Get a random sample of rejected applications for bias review"""
    
    # Get rejected applications from the last N days
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)
    
    rejected_apps = db.query(Application).filter(
        and_(
            Application.status == "rejected",
            Application.updated_at >= cutoff_date
        )
    ).all()
    
    # Calculate sample size
    total_rejected = len(rejected_apps)
    sample_size = max(1, int(total_rejected * sample_rate))
    
    # Random sample
    sampled_apps = random.sample(rejected_apps, min(sample_size, total_rejected))
    
    # Get rejection reasons from status updates
    result = []
    for app in sampled_apps:
        # Get the rejection status update
        rejection_update = db.query(StatusUpdate).filter(
            and_(
                StatusUpdate.application_id == app.id,
                StatusUpdate.status == "rejected"
            )
        ).order_by(StatusUpdate.timestamp.desc()).first()
        
        # Check if already reviewed
        review_data = bias_reviews.get(app.id, {})
        
        # Parse answers for additional context
        answers = json.loads(app.answers) if app.answers else {}
        
        app_data = {
            "application": {
                "id": app.id,
                "applicant_name": answers.get("applicant_name", "Unknown"),
                "visa_type": app.visa_type,
                "status": app.status,
                "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
                "country": answers.get("nationality", "Unknown"),
                "risk_score": app.risk_score,
                "documents_count": db.query(func.count()).filter_by(application_id=app.id).scalar()
            },
            "rejection_reason": rejection_update.notes if rejection_update else "No reason provided",
            "ai_confidence": random.randint(65, 95),  # Mock AI confidence
            "reviewed": review_data.get("reviewed", False),
            "review_result": review_data.get("result"),
            "review_notes": review_data.get("notes"),
            "reviewed_by": review_data.get("officer_id"),
            "reviewed_at": review_data.get("timestamp")
        }
        
        result.append(app_data)
    
    # Calculate bias statistics
    reviewed_count = sum(1 for r in result if r["reviewed"])
    bias_count = sum(1 for r in result if r.get("review_result") == "biased")
    
    statistics = {
        "total_rejected": total_rejected,
        "sample_size": len(result),
        "reviewed_count": reviewed_count,
        "bias_detected_count": bias_count,
        "bias_rate": (bias_count / reviewed_count * 100) if reviewed_count > 0 else 0,
        "common_bias_patterns": analyze_bias_patterns(result)
    }
    
    return {
        "cases": result,
        "statistics": statistics
    }

@router.post("/review/{application_id}")
async def submit_bias_review(
    application_id: str,
    review_data: dict,
    db: Session = Depends(get_db)
):
    """Submit a bias review for an application"""
    
    # Verify application exists and is rejected
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app.status != "rejected":
        raise HTTPException(status_code=400, detail="Can only review rejected applications")
    
    # Store review (in production, save to database)
    bias_reviews[application_id] = {
        "reviewed": True,
        "result": review_data.get("result"),  # 'justified', 'biased', 'uncertain'
        "notes": review_data.get("notes"),
        "officer_id": review_data.get("officer_id"),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # If bias detected, create a status update for tracking
    if review_data.get("result") == "biased":
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=application_id,
            status="bias_review",
            notes=f"Potential bias detected in rejection: {review_data.get('notes')}",
            officer_id=review_data.get("officer_id"),
            timestamp=datetime.utcnow()
        )
        db.add(status_update)
        db.commit()
        
        # In production, this could trigger:
        # - Re-review of the application
        # - Notification to senior officers
        # - Update to AI training data
        # - Automatic status change if appropriate
    
    return {
        "message": "Bias review submitted successfully",
        "review": bias_reviews[application_id]
    }

@router.get("/statistics")
async def get_bias_statistics(
    days_back: int = Query(90, description="Days to analyze"),
    db: Session = Depends(get_db)
):
    """Get comprehensive bias statistics"""
    
    # This would analyze patterns across all reviews
    all_reviews = list(bias_reviews.values())
    
    bias_by_country = {}
    bias_by_visa_type = {}
    
    # Analyze patterns (simplified for demo)
    for app_id, review in bias_reviews.items():
        if review.get("result") == "biased":
            # Get application details
            app = db.query(Application).filter(Application.id == app_id).first()
            if app:
                answers = json.loads(app.answers) if app.answers else {}
                country = answers.get("nationality", "Unknown")
                
                bias_by_country[country] = bias_by_country.get(country, 0) + 1
                bias_by_visa_type[app.visa_type] = bias_by_visa_type.get(app.visa_type, 0) + 1
    
    return {
        "total_reviews": len(all_reviews),
        "bias_cases": sum(1 for r in all_reviews if r.get("result") == "biased"),
        "bias_by_country": bias_by_country,
        "bias_by_visa_type": bias_by_visa_type,
        "recommendations": generate_bias_recommendations(bias_by_country, bias_by_visa_type)
    }

def analyze_bias_patterns(cases: List[dict]) -> List[str]:
    """Analyze common patterns in biased rejections"""
    
    patterns = []
    
    # Country-based patterns
    country_rejections = {}
    for case in cases:
        if case.get("review_result") == "biased":
            country = case["application"]["country"]
            country_rejections[country] = country_rejections.get(country, 0) + 1
    
    if country_rejections:
        top_country = max(country_rejections, key=country_rejections.get)
        patterns.append(f"Country of origin bias ({top_country}: {country_rejections[top_country]} cases)")
    
    # Risk score patterns
    high_risk_bias = sum(1 for c in cases 
                        if c.get("review_result") == "biased" 
                        and c["application"]["risk_score"] > 60)
    if high_risk_bias > 0:
        patterns.append(f"High risk score bias ({high_risk_bias} cases)")
    
    # Add more pattern analysis as needed
    if not patterns:
        patterns = ["No clear patterns detected yet"]
    
    return patterns

def generate_bias_recommendations(bias_by_country: dict, bias_by_visa_type: dict) -> List[str]:
    """Generate recommendations based on bias patterns"""
    
    recommendations = []
    
    if bias_by_country:
        top_countries = sorted(bias_by_country.items(), key=lambda x: x[1], reverse=True)[:3]
        recommendations.append(
            f"Review AI training data for applications from: {', '.join([c[0] for c in top_countries])}"
        )
    
    if bias_by_visa_type:
        top_types = sorted(bias_by_visa_type.items(), key=lambda x: x[1], reverse=True)[:3]
        recommendations.append(
            f"Adjust risk assessment for visa types: {', '.join([t[0] for t in top_types])}"
        )
    
    recommendations.extend([
        "Consider implementing additional human review for high-risk rejections",
        "Update AI model with corrected bias cases as training data",
        "Establish clear guidelines for country-neutral risk assessment"
    ])
    
    return recommendations