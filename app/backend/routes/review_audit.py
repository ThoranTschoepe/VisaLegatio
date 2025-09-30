# backend/routes/review_audit.py - Senior officer audit workflow

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from datetime import datetime

from database import (
    get_db,
    Application,
    Officer,
    BiasReview,
    ReviewAudit,
    StatusUpdate,
)
from utils import generate_id

router = APIRouter()

ALLOWED_DECISIONS = {
    "clear_to_proceed",
    "request_clarification",
    "request_additional_docs",
    "issue_conditional_approval",
    "escalate_to_policy",
    "escalate_to_security",
    "overturn_flag",
    "refer_for_training",
}
DECISION_NORMALIZATION = {
    "clear_to_proceed": "clear_to_proceed",
    "validated": "clear_to_proceed",
    "request_clarification": "request_clarification",
    "request_additional_docs": "request_additional_docs",
    "request_more_docs": "request_additional_docs",
    "issue_conditional_approval": "issue_conditional_approval",
    "escalate_to_policy": "escalate_to_policy",
    "escalated": "escalate_to_policy",
    "escalate_policy": "escalate_to_policy",
    "escalate_to_security": "escalate_to_security",
    "escalate_security": "escalate_to_security",
    "overturn_flag": "overturn_flag",
    "overturned": "overturn_flag",
    "refer_for_training": "refer_for_training",
    "training_needed": "refer_for_training",
}
DEFAULT_LIMIT = 25


def _serialize_review_with_context(review: BiasReview, db: Session) -> Dict[str, Any]:
    application = db.query(Application).filter(Application.id == review.application_id).first()
    answers = json.loads(application.answers) if application and application.answers else {}

    return {
        "review": {
            "id": review.id,
            "application_id": review.application_id,
            "officer_id": review.officer_id,
            "result": review.result,
            "notes": review.notes,
            "audit_status": review.audit_status,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        },
        "application": {
            "id": application.id if application else review.application_id,
            "visa_type": application.visa_type if application else None,
            "status": application.status if application else None,
            "risk_score": application.risk_score if application else None,
            "country": answers.get("nationality", "Unknown"),
            "applicant_name": answers.get("applicant_name", "Unknown"),
        },
        "audits": [
            {
                "id": audit.id,
                "auditor_id": audit.auditor_id,
                "decision": audit.decision,
                "notes": audit.notes,
                "created_at": audit.created_at.isoformat() if audit.created_at else None,
            }
            for audit in review.audits
        ],
    }


@router.get("/queue")
async def get_review_audit_queue(
    status: str = Query("pending", description="Audit status to filter by"),
    limit: int = Query(DEFAULT_LIMIT, description="Maximum number of reviews to return"),
    db: Session = Depends(get_db),
):
    """Return bias reviews awaiting senior officer audit."""

    query = db.query(BiasReview)
    if status != "all":
        query = query.filter(BiasReview.audit_status == status)

    reviews = (
        query.order_by(BiasReview.reviewed_at.desc())
        .limit(limit)
        .all()
    )

    payload = [_serialize_review_with_context(review, db) for review in reviews]

    return {"items": payload, "count": len(payload)}


@router.get("/{review_id}")
async def get_review_audit_detail(review_id: str, db: Session = Depends(get_db)):
    """Return a single bias review with audit history."""

    review = db.query(BiasReview).filter(BiasReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Bias review not found")

    return _serialize_review_with_context(review, db)


@router.post("/{review_id}/decision")
async def submit_review_audit_decision(
    review_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Record a senior officer audit decision and update review status."""

    review = db.query(BiasReview).filter(BiasReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Bias review not found")

    raw_decision = payload.get("decision_code") or payload.get("decision")
    if not raw_decision:
        raise HTTPException(status_code=400, detail="Decision value is required")

    decision_key = str(raw_decision).lower()
    decision = DECISION_NORMALIZATION.get(decision_key)
    if decision not in ALLOWED_DECISIONS:
        raise HTTPException(status_code=400, detail="Invalid decision value")

    auditor_id = payload.get("auditor_id")
    auditor = db.query(Officer).filter(Officer.id == auditor_id).first()
    if not auditor:
        raise HTTPException(status_code=404, detail="Auditing officer not found")

    notes = payload.get("notes")
    now = datetime.utcnow()

    audit_record = ReviewAudit(
        id=generate_id("biasaudit"),
        bias_review_id=review_id,
        auditor_id=auditor_id,
        decision=decision,
        notes=notes,
        created_at=now,
    )
    db.add(audit_record)

    review.audit_status = decision
    review.updated_at = now

    if decision == "overturn_flag":
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=review.application_id,
            status="audit_overturned",
            notes="Senior officer overturned the bias review. Re-open application.",
            officer_id=auditor_id,
            timestamp=now,
        )
        db.add(status_update)
    elif decision == "escalate_to_policy":
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=review.application_id,
            status="audit_escalated_policy",
            notes="Senior officer escalated the bias review for policy follow-up.",
            officer_id=auditor_id,
            timestamp=now,
        )
        db.add(status_update)
    elif decision == "escalate_to_security":
        status_update = StatusUpdate(
            id=generate_id("status"),
            application_id=review.application_id,
            status="audit_escalated_security",
            notes="Senior officer escalated the bias review to security & compliance.",
            officer_id=auditor_id,
            timestamp=now,
        )
        db.add(status_update)

    db.commit()
    db.refresh(review)

    return {
        "message": "Audit decision recorded",
        "review": _serialize_review_with_context(review, db),
    }
