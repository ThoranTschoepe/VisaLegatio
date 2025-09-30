"""Bias monitoring analytics API using the shared monitoring service."""

from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from services import (
    BiasReviewSubmissionError,
    get_bias_monitoring_service,
    refresh_bias_snapshot,
)

router = APIRouter()
influence_router = APIRouter()


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

    service = get_bias_monitoring_service(db)
    try:
        return service.submit_review(application_id, review_data)
    except BiasReviewSubmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/overview")
async def get_bias_monitoring_overview(
    days_back: int = Query(30, description="Number of days to include in the snapshot"),
    db: Session = Depends(get_db),
):
    """Return the latest monitoring snapshot, refreshing if stale."""

    service = get_bias_monitoring_service(db)
    return service.get_or_create_snapshot(days_back)


@router.get("/history")
async def get_bias_monitoring_history(
    limit: int = Query(10, description="Number of historical snapshots to return"),
    db: Session = Depends(get_db),
):
    """Return recent monitoring snapshots for trend charts."""

    service = get_bias_monitoring_service(db)
    return {"history": service.list_snapshots(limit)}


@router.post("/snapshot")
async def trigger_bias_monitoring_snapshot(
    background_tasks: BackgroundTasks,
    days_back: int = Query(30, description="Number of days to include in the snapshot"),
):
    """Trigger a background snapshot generation to refresh monitoring metrics."""

    background_tasks.add_task(refresh_bias_snapshot, days_back)
    return {"message": "Snapshot generation scheduled"}


@influence_router.get("/leaderboard")
async def get_bias_influence_leaderboard(
    days_back: int = Query(30, description="Rolling window for the influence model"),
    db: Session = Depends(get_db),
):
    """Return the latest bias influence leaderboard."""

    service = get_bias_monitoring_service(db)
    return service.get_influence_leaderboard(days_back)


@influence_router.get("/attributes")
async def get_bias_influence_attributes(
    db: Session = Depends(get_db),
):
    """Return the attribute glossary used by the influence model."""

    service = get_bias_monitoring_service(db)
    return service.get_attribute_catalog()


__all__ = ["router", "influence_router"]
