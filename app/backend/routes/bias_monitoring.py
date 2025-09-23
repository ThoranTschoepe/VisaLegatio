# backend/routes/bias_monitoring.py - Bias monitoring analytics API

from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import Dict, Any, List
import json

from database import (
    get_db,
    get_db_session,
    Application,
    BiasReview,
    BiasMonitoringSnapshot,
)
from utils import generate_id

router = APIRouter()


@router.get("/overview")
async def get_bias_monitoring_overview(
    days_back: int = Query(30, description="Number of days to include in the snapshot"),
    db: Session = Depends(get_db),
):
    """Return the latest monitoring snapshot, creating one if none exists."""

    snapshot = (
        db.query(BiasMonitoringSnapshot)
        .order_by(BiasMonitoringSnapshot.generated_at.desc())
        .first()
    )

    if not snapshot:
        snapshot = _create_snapshot_sync(db, days_back)

    data = json.loads(snapshot.snapshot_data) if snapshot.snapshot_data else {}

    return {
        "snapshot_id": snapshot.id,
        "generated_at": snapshot.generated_at.isoformat() if snapshot.generated_at else None,
        "metrics": data,
    }


@router.get("/history")
async def get_bias_monitoring_history(
    limit: int = Query(10, description="Number of historical snapshots to return"),
    db: Session = Depends(get_db),
):
    """Return a list of recent monitoring snapshots for trend charts."""

    snapshots = (
        db.query(BiasMonitoringSnapshot)
        .order_by(BiasMonitoringSnapshot.generated_at.desc())
        .limit(limit)
        .all()
    )

    history = []
    for snapshot in snapshots:
        history.append(
            {
                "snapshot_id": snapshot.id,
                "generated_at": snapshot.generated_at.isoformat() if snapshot.generated_at else None,
                "metrics": json.loads(snapshot.snapshot_data) if snapshot.snapshot_data else {},
            }
        )

    return {"history": history}


@router.post("/snapshot")
async def trigger_bias_monitoring_snapshot(
    background_tasks: BackgroundTasks,
    days_back: int = Query(30, description="Number of days to include in the snapshot"),
):
    """Trigger a background snapshot generation to refresh monitoring metrics."""

    background_tasks.add_task(_create_snapshot_async, days_back)
    return {"message": "Snapshot generation scheduled"}


def _create_snapshot_async(days_back: int) -> None:
    """Generate and persist a snapshot using an isolated DB session."""
    session = get_db_session()
    try:
        _create_snapshot_sync(session, days_back)
    finally:
        session.close()


def _create_snapshot_sync(db: Session, days_back: int) -> BiasMonitoringSnapshot:
    """Compute monitoring metrics and persist a snapshot within the provided session."""

    metrics = _compute_monitoring_metrics(db, days_back)

    snapshot = BiasMonitoringSnapshot(
        id=generate_id("biasmon"),
        generated_at=datetime.utcnow(),
        total_rejected=metrics.get("total_rejected", 0),
        sampled_count=metrics.get("sampled_count", 0),
        reviewed_count=metrics.get("reviewed_count", 0),
        bias_detected_count=metrics.get("bias_detected_count", 0),
        bias_rate=metrics.get("bias_rate", 0.0),
        snapshot_data=json.dumps(metrics),
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def _compute_monitoring_metrics(db: Session, days_back: int) -> Dict[str, Any]:
    """Aggregate metrics used by the monitoring dashboards."""

    cutoff_date = datetime.utcnow() - timedelta(days=days_back)

    total_rejected = (
        db.query(Application)
        .filter(
            and_(
                Application.status == "rejected",
                Application.updated_at >= cutoff_date,
            )
        )
        .count()
    )

    reviews: List[BiasReview] = (
        db.query(BiasReview)
        .filter(BiasReview.reviewed_at >= cutoff_date)
        .all()
    )

    reviewed_count = len(reviews)
    bias_reviews = [review for review in reviews if review.result == "biased"]
    bias_detected_count = len(bias_reviews)
    bias_rate = (bias_detected_count / reviewed_count * 100.0) if reviewed_count else 0.0

    bias_by_country: Dict[str, int] = {}
    bias_by_visa_type: Dict[str, int] = {}
    audit_status_breakdown: Dict[str, int] = {}

    for review in reviews:
        audit_status_breakdown[review.audit_status] = audit_status_breakdown.get(review.audit_status, 0) + 1

    for review in bias_reviews:
        app = db.query(Application).filter(Application.id == review.application_id).first()
        if not app:
            continue
        answers = json.loads(app.answers) if app.answers else {}
        country = answers.get("nationality", "Unknown")
        bias_by_country[country] = bias_by_country.get(country, 0) + 1
        bias_by_visa_type[app.visa_type] = bias_by_visa_type.get(app.visa_type, 0) + 1

    patterns = _analyze_bias_patterns(bias_reviews, db)
    alerts = _determine_alerts(bias_rate, patterns)

    return {
        "total_rejected": total_rejected,
        "sampled_count": min(total_rejected, max(1, int(total_rejected * 0.1))) if total_rejected else 0,
        "reviewed_count": reviewed_count,
        "bias_detected_count": bias_detected_count,
        "bias_rate": round(bias_rate, 2),
        "bias_by_country": bias_by_country,
        "bias_by_visa_type": bias_by_visa_type,
        "audit_status_breakdown": audit_status_breakdown,
        "common_bias_patterns": patterns,
        "alerts": alerts,
        "window_days": days_back,
    }


def _analyze_bias_patterns(reviews: List[BiasReview], db: Session) -> List[str]:
    """Return human-readable bias pattern summaries."""

    if not reviews:
        return []

    pattern_counts: Dict[str, int] = {}

    for review in reviews:
        app = db.query(Application).filter(Application.id == review.application_id).first()
        if not app:
            continue
        answers = json.loads(app.answers) if app.answers else {}
        country = answers.get("nationality", "Unknown")
        pattern_counts[f"Country: {country}"] = pattern_counts.get(f"Country: {country}", 0) + 1
        pattern_counts[f"Visa: {app.visa_type}"] = pattern_counts.get(f"Visa: {app.visa_type}", 0) + 1

    ranked = sorted(pattern_counts.items(), key=lambda item: item[1], reverse=True)
    return [f"{label} ({count} cases)" for label, count in ranked[:5]]


def _determine_alerts(bias_rate: float, patterns: List[str]) -> List[str]:
    """Generate alert messages for the monitoring dashboard."""

    alerts: List[str] = []

    if bias_rate > 25:
        alerts.append("Bias rate exceeds 25% threshold — immediate review recommended")
    elif bias_rate > 10:
        alerts.append("Bias rate trending high — schedule focused audit")

    if patterns:
        alerts.append("Investigate top recurring bias patterns")

    return alerts
