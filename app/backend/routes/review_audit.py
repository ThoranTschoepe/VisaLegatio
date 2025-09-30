# backend/routes/review_audit.py - Senior officer audit workflow

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Set
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
from services.review_flags import get_flag_catalog
from .applications import FLAG_AUDITED_STATUS, determine_application_status

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


def _serialize_review_with_context(
    review: BiasReview,
    db: Session,
    decision_matrix: Dict[str, List[Dict[str, Any]]],
    decisions_catalog: List[Dict[str, Any]],
) -> Dict[str, Any]:
    application = db.query(Application).filter(Application.id == review.application_id).first()
    answers = json.loads(application.answers) if application and application.answers else {}

    flags = list(review.flags or [])
    flags_payload: List[Dict[str, Any]] = []
    allowed_decision_sets: Dict[str, Set[str]] = {}

    for flag in flags:
        flag_type = flag.flag_type or "document_gap"
        matrix_entries = decision_matrix.get(flag_type, [])

        if matrix_entries:
            allowed_entries = [dict(entry) for entry in matrix_entries]
        else:
            allowed_entries = [
                {
                    "code": decision["code"],
                    "label": decision.get("label"),
                    "description": decision.get("description"),
                    "severity": decision.get("severity"),
                    "requiresFollowUp": False,
                }
                for decision in decisions_catalog
            ]

        allowed_codes = [entry["code"] for entry in allowed_entries]
        if flag_type and allowed_codes:
            allowed_decision_sets.setdefault(flag_type, set()).update(allowed_codes)

        flags_payload.append(
            {
                "id": flag.id,
                "flag_type": flag_type,
                "reason": flag.reason,
                "resolved": bool(flag.resolved),
                "flagged_at": flag.flagged_at.isoformat() if flag.flagged_at else None,
                "resolved_at": flag.resolved_at.isoformat() if flag.resolved_at else None,
                "flagged_by": flag.flagged_by_officer_id,
                "document": (
                    {
                        "id": flag.document.id,
                        "name": flag.document.name,
                        "type": flag.document.type,
                        "verified": flag.document.verified,
                    }
                    if flag.document
                    else None
                ),
                "allowed_decisions": allowed_codes,
                "allowed_decision_details": allowed_entries,
            }
        )

    active_flags = [flag for flag in flags if not flag.resolved]

    flag_summary = {
        "total": len(flags),
        "active": len(active_flags),
        "types": sorted({flag.flag_type or "document_gap" for flag in flags}),
        "active_types": sorted({flag.flag_type or "document_gap" for flag in active_flags}),
    }

    allowed_decisions = {
        flag_type: sorted(list(codes)) for flag_type, codes in allowed_decision_sets.items()
    }

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
        "flags": flags_payload,
        "flag_summary": flag_summary,
        "allowed_decisions": allowed_decisions,
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

    catalog = get_flag_catalog(db)
    decision_matrix = catalog.get("matrix", {})
    decisions_catalog = catalog.get("decisions", [])

    payload = [
        _serialize_review_with_context(review, db, decision_matrix, decisions_catalog)
        for review in reviews
    ]

    return {"items": payload, "count": len(payload), "decisionMatrix": decision_matrix}


@router.get("/{review_id}")
async def get_review_audit_detail(review_id: str, db: Session = Depends(get_db)):
    """Return a single bias review with audit history."""

    review = db.query(BiasReview).filter(BiasReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Bias review not found")

    catalog = get_flag_catalog(db)
    decision_matrix = catalog.get("matrix", {})
    decisions_catalog = catalog.get("decisions", [])

    payload = _serialize_review_with_context(review, db, decision_matrix, decisions_catalog)
    return {**payload, "decisionMatrix": decision_matrix}


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

    application = review.application
    application_status_changed = False
    if application:
        active_flags = [flag for flag in review.flags if not flag.resolved]
        if active_flags:
            if application.status != FLAG_AUDITED_STATUS:
                application.status = FLAG_AUDITED_STATUS
                application.updated_at = now
                status_note = f"Senior audit decision recorded: {decision}."
                db.add(
                    StatusUpdate(
                        id=generate_id("status"),
                        application_id=application.id,
                        status=FLAG_AUDITED_STATUS,
                        notes=status_note,
                        officer_id=auditor_id,
                        timestamp=now,
                    )
                )
                application_status_changed = True
        else:
            next_status = determine_application_status(application.id, application.visa_type, db)
            if next_status and application.status != next_status:
                application.status = next_status
                application.updated_at = now
                status_note = f"Application status updated after audit: {next_status}."
                db.add(
                    StatusUpdate(
                        id=generate_id("status"),
                        application_id=application.id,
                        status=next_status,
                        notes=status_note,
                        officer_id=auditor_id,
                        timestamp=now,
                    )
                )
                application_status_changed = True

        if application_status_changed:
            db.commit()
            db.refresh(review)
            application = review.application
    catalog = get_flag_catalog(db)
    decision_matrix = catalog.get("matrix", {})
    decisions_catalog = catalog.get("decisions", [])
    payload = _serialize_review_with_context(review, db, decision_matrix, decisions_catalog)

    return {
        "message": "Audit decision recorded",
        "review": payload,
        "decisionMatrix": decision_matrix,
    }
