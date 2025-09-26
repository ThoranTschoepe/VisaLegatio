# backend/routes/bias_review.py - AI Bias Review API

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json

from database import (
    get_db,
    Application,
    StatusUpdate,
    Officer,
    BiasReview,
)
from utils import generate_id
from services import get_bias_monitoring_service

router = APIRouter()


@router.get("/sample")
async def get_bias_review_sample(
    sample_rate: float = Query(1.0, description="Fraction of rejections to sample"),
    days_back: int = Query(30, description="Days to look back for rejections"),
    db: Session = Depends(get_db),
):
    """Return a deterministic sample of recent rejected applications for bias review."""

    service = get_bias_monitoring_service(db)
    return service.get_review_sample(sample_rate, days_back)


@router.get("/cadence")
async def get_bias_review_cadence(
    db: Session = Depends(get_db),
):
    """Return the persisted review cadence analytics."""

    service = get_bias_monitoring_service(db)
    return service.get_review_cadence()


@router.post("/review/{application_id}")
async def submit_bias_review(
    application_id: str,
    review_data: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Persist a bias review decision for a rejected application."""

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.status != "rejected":
        raise HTTPException(status_code=400, detail="Can only review rejected applications")

    officer_id = review_data.get("officer_id")
    if officer_id:
        officer_exists = db.query(Officer).filter(Officer.id == officer_id).first()
        if not officer_exists:
            raise HTTPException(status_code=404, detail="Reviewing officer not found")

    now = datetime.utcnow()
    existing_review = (
        db.query(BiasReview)
        .filter(BiasReview.application_id == application_id)
        .order_by(BiasReview.reviewed_at.desc())
        .first()
    )

    if existing_review:
        existing_review.result = review_data.get("result", existing_review.result)
        existing_review.notes = review_data.get("notes", existing_review.notes)
        existing_review.officer_id = officer_id or existing_review.officer_id
        existing_review.ai_confidence = review_data.get("ai_confidence", existing_review.ai_confidence)
        existing_review.reviewed_at = now
        existing_review.audit_status = "pending"
        existing_review.updated_at = now
        bias_review_record = existing_review
    else:
        bias_review_record = BiasReview(
            id=generate_id("biasreview"),
            application_id=application_id,
            officer_id=officer_id,
            result=review_data.get("result"),
            notes=review_data.get("notes"),
            ai_confidence=review_data.get("ai_confidence"),
            audit_status="pending",
            reviewed_at=now,
        )
        db.add(bias_review_record)

    if review_data.get("result") == "biased":
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=application_id,
            status="bias_review",
            notes=f"Potential bias detected in rejection: {review_data.get('notes')}",
            officer_id=officer_id,
            timestamp=now,
        )
        db.add(status_update)

    db.commit()
    db.refresh(bias_review_record)

    return {
        "message": "Bias review submitted successfully",
        "review": {
            "id": bias_review_record.id,
            "result": bias_review_record.result,
            "notes": bias_review_record.notes,
            "officer_id": bias_review_record.officer_id,
            "reviewed_at": bias_review_record.reviewed_at.isoformat() if bias_review_record.reviewed_at else None,
            "audit_status": bias_review_record.audit_status,
        },
    }


@router.get("/statistics")
async def get_bias_statistics(
    days_back: int = Query(90, description="Days to analyze"),
    db: Session = Depends(get_db),
):
    """Aggregate historical bias review statistics for monitoring dashboards."""

    cutoff_date = datetime.utcnow() - timedelta(days=days_back)
    reviews = (
        db.query(BiasReview)
        .filter(BiasReview.reviewed_at >= cutoff_date)
        .all()
    )

    bias_by_country: Dict[str, int] = {}
    bias_by_visa_type: Dict[str, int] = {}

    for review in reviews:
        if review.result != "biased":
            continue

        app = db.query(Application).filter(Application.id == review.application_id).first()
        if not app:
            continue

        answers = json.loads(app.answers) if app.answers else {}
        country = answers.get("nationality", "Unknown")

        bias_by_country[country] = bias_by_country.get(country, 0) + 1
        bias_by_visa_type[app.visa_type] = bias_by_visa_type.get(app.visa_type, 0) + 1

    total_reviews = len(reviews)
    bias_cases = len([r for r in reviews if r.result == "biased"])

    return {
        "total_reviews": total_reviews,
        "bias_cases": bias_cases,
        "bias_by_country": bias_by_country,
        "bias_by_visa_type": bias_by_visa_type,
        "recommendations": generate_bias_recommendations(bias_by_country, bias_by_visa_type),
    }


def generate_bias_recommendations(bias_by_country: dict, bias_by_visa_type: dict) -> List[str]:
    """Generate recommendations based on bias patterns."""

    recommendations: List[str] = []

    if bias_by_country:
        top_countries = sorted(bias_by_country.items(), key=lambda x: x[1], reverse=True)[:3]
        recommendations.append(
            "Review AI training data for applications from: "
            + ", ".join([country for country, _ in top_countries])
        )

    if bias_by_visa_type:
        top_types = sorted(bias_by_visa_type.items(), key=lambda x: x[1], reverse=True)[:3]
        recommendations.append(
            "Adjust risk assessment for visa types: "
            + ", ".join([visa_type for visa_type, _ in top_types])
        )

    recommendations.extend(
        [
            "Consider implementing additional human review for high-risk rejections",
            "Update AI model with corrected bias cases as training data",
            "Establish clear guidelines for country-neutral risk assessment",
        ]
    )

    return recommendations
