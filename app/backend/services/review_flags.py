"""Utilities for keeping bias review flags in sync with document-level flags."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database import BiasReview, BiasReviewFlag, Document, FlaggedDocument
from utils import generate_id


def _build_metadata(document: Optional[Document]) -> Optional[str]:
    """Capture lightweight document metadata for audit reviewers."""
    if not document:
        return None

    payload = {
        "file_path": document.file_path,
        "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None,
        "verified": document.verified,
        "size": document.size,
    }

    # Remove keys with None to keep JSON compact
    compact = {key: value for key, value in payload.items() if value is not None}
    if not compact:
        return None

    return json.dumps(compact)


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

    existing_by_doc_id = {
        flag.flagged_document_id: flag
        for flag in review.flags
        if flag.flagged_document_id
    }

    seen_flag_ids = set()

    for doc_flag in document_flags:
        document = doc_flag.document
        metadata = _build_metadata(document)
        existing = existing_by_doc_id.get(doc_flag.id)

        if existing:
            existing.reason = doc_flag.reason
            existing.flagged_by_officer_id = doc_flag.flagged_by_officer_id
            existing.flagged_at = doc_flag.flagged_at
            existing.document_id = doc_flag.document_id
            existing.document_name = document.name if document else existing.document_name
            existing.document_type = document.type if document else existing.document_type
            existing.resolved = doc_flag.resolved
            existing.resolved_at = doc_flag.resolved_at
            existing.metadata = metadata
        else:
            review_flag = BiasReviewFlag(
                id=generate_id("bflag"),
                bias_review_id=review.id,
                application_id=application_id,
                flagged_document_id=doc_flag.id,
                document_id=doc_flag.document_id,
                document_name=document.name if document else None,
                document_type=document.type if document else None,
                reason=doc_flag.reason,
                flagged_by_officer_id=doc_flag.flagged_by_officer_id,
                flagged_at=doc_flag.flagged_at,
                resolved=doc_flag.resolved,
                resolved_at=doc_flag.resolved_at,
                metadata=metadata,
            )
            db.add(review_flag)

        seen_flag_ids.add(doc_flag.id)

    # Flags without a backing document flag should be marked resolved to avoid stale records
    for review_flag in review.flags:
        if review_flag.flagged_document_id and review_flag.flagged_document_id not in seen_flag_ids:
            if not review_flag.resolved:
                review_flag.resolved = True
                review_flag.resolved_at = review_flag.resolved_at or datetime.utcnow()

    db.flush()
    return review
