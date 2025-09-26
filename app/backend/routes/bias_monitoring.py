"""Bias monitoring analytics API using the shared monitoring service."""

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from services import get_bias_monitoring_service, refresh_bias_snapshot

router = APIRouter()
influence_router = APIRouter()


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
