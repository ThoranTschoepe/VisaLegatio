"""Helpers for synchronising document-level flags with the bias-review audit flow."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database import Application, BiasReview, FlaggedDocument, FlagCategory, DecisionCategory, Officer, FlagDecisionRule
from utils import generate_id


def get_flag_catalog(db: Session):
    """Return canonical flag categories, decision categories, and the compatibility matrix."""

    categories = db.query(FlagCategory).order_by(FlagCategory.code.asc()).all()
    decisions = db.query(DecisionCategory).order_by(DecisionCategory.code.asc()).all()
    rules = (
        db.query(FlagDecisionRule)
        .join(FlagCategory, FlagDecisionRule.flag_category_id == FlagCategory.id)
        .join(DecisionCategory, FlagDecisionRule.decision_id == DecisionCategory.id)
        .all()
    )

    matrix = {}
    for rule in rules:
        category = rule.flag_category
        decision = rule.decision_category
        if not category or not decision:
            continue
        matrix.setdefault(category.code, []).append(
            {
                'code': decision.code,
                'label': decision.label,
                'requiresFollowUp': rule.requires_follow_up,
                'severity': decision.severity,
                'description': decision.description,
            }
        )

    for entries in matrix.values():
        entries.sort(key=lambda entry: entry['code'])

    return {
        'categories': [
            {
                'code': category.code,
                'label': category.label,
                'description': category.description,
            }
            for category in categories
        ],
        'decisions': [
            {
                'code': decision.code,
                'label': decision.label,
                'description': decision.description,
                'severity': decision.severity,
            }
            for decision in decisions
        ],
        'matrix': matrix,
    }


def sync_review_flags_for_application(db: Session, application_id: str) -> Optional[BiasReview]:
    """Ensure the latest bias review mirrors the application's document flags."""

    review = (
        db.query(BiasReview)
        .filter(BiasReview.application_id == application_id)
        .order_by(BiasReview.reviewed_at.desc())
        .first()
    )
    if not review:
        return None

    document_flags = (
        db.query(FlaggedDocument)
        .filter(FlaggedDocument.application_id == application_id)
        .all()
    )

    active_flags = [doc_flag for doc_flag in document_flags if not doc_flag.resolved]

    if not active_flags and not review.audits:
        for doc_flag in document_flags:
            doc_flag.bias_review_id = None
        db.delete(review)
        db.flush()
        return None

    for doc_flag in document_flags:
        doc_flag.bias_review_id = review.id
        if not doc_flag.flag_type:
            doc_flag.flag_type = 'document_gap'

    if active_flags and review.audit_status != 'pending':
        review.audit_status = 'pending'
        review.updated_at = datetime.utcnow()
    elif not active_flags and review.audit_status in (None, '', 'pending'):
        review.audit_status = 'clear_to_proceed'
        review.updated_at = datetime.utcnow()

    db.flush()
    return review


def _resolve_officer_id(db: Session, application: Application, flagged_document: FlaggedDocument) -> Optional[str]:
    if flagged_document.flagged_by_officer_id:
        return flagged_document.flagged_by_officer_id
    if application.assigned_officer_id:
        return application.assigned_officer_id
    officer = db.query(Officer.id).order_by(Officer.created_at.asc()).first()
    return officer[0] if officer else None


def ensure_review_for_flagged_document(
    db: Session,
    application: Application,
    flagged_document: FlaggedDocument,
) -> Optional[BiasReview]:
    """Guarantee that a bias review entry exists for a flagged document and sync review flags."""

    officer_id = _resolve_officer_id(db, application, flagged_document)
    if not officer_id:
        return None

    now = datetime.utcnow()
    review = (
        db.query(BiasReview)
        .filter(BiasReview.application_id == application.id)
        .filter(BiasReview.audit_status == 'pending')
        .order_by(BiasReview.reviewed_at.desc())
        .first()
    )

    flag_reason = flagged_document.reason or 'Document flagged for review'
    flagged_at = flagged_document.flagged_at or now

    if not review:
        review = BiasReview(
            id=generate_id('biasreview'),
            application_id=application.id,
            officer_id=officer_id,
            result='uncertain',
            notes=flag_reason,
            ai_confidence=None,
            audit_status='pending',
            reviewed_at=flagged_at,
            created_at=now,
            updated_at=now,
        )
        db.add(review)
        db.flush()
    else:
        if not review.officer_id:
            review.officer_id = officer_id
        review.audit_status = 'pending'
        review.updated_at = now
        if not review.reviewed_at or flagged_at > review.reviewed_at:
            review.reviewed_at = flagged_at
        if flag_reason:
            existing_notes = review.notes or ''
            if flag_reason not in existing_notes:
                review.notes = f"{flag_reason}\n\n{existing_notes}".strip()

    sync_review_flags_for_application(db, application.id)
    return review


__all__ = [
    'get_flag_catalog',
    'sync_review_flags_for_application',
    'ensure_review_for_flagged_document',
]
