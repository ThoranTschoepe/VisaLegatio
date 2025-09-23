# backend/routes/bias_review.py - AI Bias Review API

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import random

from database import (
    get_db,
    Application,
    StatusUpdate,
    Officer,
    Document,
    BiasReview,
)
from utils import generate_id

router = APIRouter()


def _serialize_case(
    application: Application,
    rejection_reason: str,
    review: Optional[BiasReview],
    documents_count: int,
) -> Dict[str, Any]:
    """Serialize a rejection case for frontend consumption."""
    answers = json.loads(application.answers) if application.answers else {}

    return {
        "application": {
            "id": application.id,
            "applicant_name": answers.get("applicant_name", "Unknown"),
            "visa_type": application.visa_type,
            "status": application.status,
            "submitted_at": application.submitted_at.isoformat() if application.submitted_at else None,
            "country": answers.get("nationality", "Unknown"),
            "risk_score": application.risk_score,
            "documents_count": documents_count,
        },
        "rejection_reason": rejection_reason or "No reason provided",
        "ai_confidence": review.ai_confidence if review and review.ai_confidence is not None else random.randint(65, 95),
        "reviewed": bool(review),
        "review_result": review.result if review else None,
        "review_notes": review.notes if review else None,
        "reviewed_by": review.officer_id if review else None,
        "reviewed_at": review.reviewed_at.isoformat() if review and review.reviewed_at else None,
        "audit_status": review.audit_status if review else "pending",
    }


@router.get("/sample")
async def get_bias_review_sample(
    sample_rate: float = Query(0.1, description="Percentage of rejections to sample"),
    days_back: int = Query(30, description="Days to look back for rejections"),
    db: Session = Depends(get_db),
):
    """Return a randomized sample of recent rejected applications for bias review."""

    cutoff_date = datetime.utcnow() - timedelta(days=days_back)

    rejected_apps = (
        db.query(Application)
        .filter(
            and_(
                Application.status == "rejected",
                Application.updated_at >= cutoff_date,
            )
        )
        .all()
    )

    total_rejected = len(rejected_apps)
    if total_rejected == 0:
        return {"cases": [], "statistics": _empty_statistics()}

    sample_size = max(1, int(total_rejected * sample_rate))
    sampled_apps = random.sample(rejected_apps, min(sample_size, total_rejected))

    cases: List[Dict[str, Any]] = []
    for app in sampled_apps:
        rejection_update = (
            db.query(StatusUpdate)
            .filter(
                and_(
                    StatusUpdate.application_id == app.id,
                    StatusUpdate.status == "rejected",
                )
            )
            .order_by(StatusUpdate.timestamp.desc())
            .first()
        )

        review = (
            db.query(BiasReview)
            .filter(BiasReview.application_id == app.id)
            .order_by(BiasReview.reviewed_at.desc())
            .first()
        )

        documents_count = (
            db.query(func.count())
            .select_from(Document)
            .filter(Document.application_id == app.id)
            .scalar()
        ) or 0

        cases.append(
            _serialize_case(
                app,
                rejection_update.notes if rejection_update else "",
                review,
                documents_count,
            )
        )

    statistics = _build_statistics_from_cases(cases, total_rejected)

    return {
        "cases": cases,
        "statistics": statistics,
    }


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


def _build_statistics_from_cases(cases: List[Dict[str, Any]], total_rejected: int) -> Dict[str, Any]:
    reviewed_count = sum(1 for case in cases if case["reviewed"])
    bias_count = sum(1 for case in cases if case.get("review_result") == "biased")

    return {
        "total_rejected": total_rejected,
        "sample_size": len(cases),
        "reviewed_count": reviewed_count,
        "bias_detected_count": bias_count,
        "bias_rate": (bias_count / reviewed_count * 100) if reviewed_count > 0 else 0,
        "common_bias_patterns": analyze_bias_patterns(cases),
    }


def _empty_statistics() -> Dict[str, Any]:
    return {
        "total_rejected": 0,
        "sample_size": 0,
        "reviewed_count": 0,
        "bias_detected_count": 0,
        "bias_rate": 0,
        "common_bias_patterns": [],
    }


def analyze_bias_patterns(cases: List[dict]) -> List[str]:
    """Analyze common patterns in biased rejections."""

    patterns: List[str] = []

    country_rejections: Dict[str, int] = {}
    for case in cases:
        if case.get("review_result") == "biased":
            country = case["application"].get("country", "Unknown")
            country_rejections[country] = country_rejections.get(country, 0) + 1

    if country_rejections:
        top_country = max(country_rejections, key=country_rejections.get)
        patterns.append(
            f"Country of origin bias ({top_country}: {country_rejections[top_country]} cases)"
        )

    high_risk_bias = sum(
        1
        for case in cases
        if case.get("review_result") == "biased"
        and case["application"].get("risk_score") is not None
        and case["application"].get("risk_score") > 60
    )
    if high_risk_bias > 0:
        patterns.append(f"High risk score bias ({high_risk_bias} cases)")

    if not patterns:
        patterns = ["No clear patterns detected yet"]

    return patterns


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
