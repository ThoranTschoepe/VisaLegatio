

# backend/routes/analytics.py - Analytics and reporting API

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta
from typing import Optional

from database import get_db, Application, Document, StatusUpdate
from models import AnalyticsResponse

router = APIRouter()

@router.get("/dashboard", response_model=AnalyticsResponse)
async def get_dashboard_analytics(
    embassy_id: Optional[str] = Query(None, description="Filter by embassy"),
    days: Optional[int] = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get analytics data for embassy dashboard"""
    
    # Date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Base query
    query = db.query(Application)
    if embassy_id:
        # In a real app, filter by embassy through officer assignments
        pass
    
    # Total applications
    total_applications = query.count()
    
    # Applications in date range
    recent_apps = query.filter(Application.submitted_at >= start_date).all()
    
    # Basic statistics
    total_recent = len(recent_apps)
    approved_count = len([app for app in recent_apps if app.status == "approved"])
    rejected_count = len([app for app in recent_apps if app.status == "rejected"])
    pending_count = len([app for app in recent_apps if app.status not in ["approved", "rejected"]])
    
    # Approval rate
    processed_count = approved_count + rejected_count
    approval_rate = (approved_count / processed_count * 100) if processed_count > 0 else 0
    
    # Average processing time (mock calculation)
    avg_processing_time = 8.5  # Mock value for demo
    
    # Trends data (last 6 months)
    trends_data = []
    for i in range(6):
        month_start = datetime.utcnow().replace(day=1) - timedelta(days=30*i)
        month_end = month_start + timedelta(days=30)
        
        month_apps = [app for app in recent_apps 
                     if month_start <= app.submitted_at < month_end]
        
        trends_data.append({
            "month": month_start.strftime("%b %Y"),
            "applications": len(month_apps),
            "approvals": len([app for app in month_apps if app.status == "approved"]),
            "rejections": len([app for app in month_apps if app.status == "rejected"])
        })
    
    trends_data.reverse()  # Chronological order
    
    # Visa type distribution
    visa_types = {}
    for app in recent_apps:
        visa_types[app.visa_type] = visa_types.get(app.visa_type, 0) + 1
    
    visa_type_distribution = [
        {
            "type": visa_type.title(),
            "count": count,
            "percentage": round(count / total_recent * 100, 1) if total_recent > 0 else 0
        }
        for visa_type, count in visa_types.items()
    ]
    
    # Country statistics (mock data for demo)
    country_stats = [
        {"country": "Germany", "applications": 425, "approval_rate": 92.5},
        {"country": "United Kingdom", "applications": 298, "approval_rate": 88.9},
        {"country": "France", "applications": 234, "approval_rate": 85.7},
        {"country": "Spain", "applications": 156, "approval_rate": 83.3},
        {"country": "Italy", "applications": 134, "approval_rate": 89.6}
    ]
    
    # Processing time by visa type (mock data)
    processing_time_by_type = [
        {"visa_type": "Tourist", "avg_days": 6.5, "trend": "down"},
        {"visa_type": "Business", "avg_days": 8.2, "trend": "stable"},
        {"visa_type": "Student", "avg_days": 14.8, "trend": "up"},
        {"visa_type": "Work", "avg_days": 21.3, "trend": "down"},
        {"visa_type": "Family Visit", "avg_days": 9.7, "trend": "stable"}
    ]
    
    return AnalyticsResponse(
        total_applications=total_applications,
        approval_rate=approval_rate,
        avg_processing_time=avg_processing_time,
        pending_applications=pending_count,
        trends_data=trends_data,
        visa_type_distribution=visa_type_distribution,
        country_stats=country_stats,
        processing_time_by_type=processing_time_by_type
    )

@router.get("/metrics/summary")
async def get_metrics_summary(db: Session = Depends(get_db)):
    """Get quick metrics summary for dashboard cards"""
    
    # Count applications by status
    status_counts = db.query(
        Application.status,
        func.count(Application.id).label('count')
    ).group_by(Application.status).all()
    
    status_dict = {status: count for status, count in status_counts}
    
    return {
        "total_applications": sum(status_dict.values()),
        "pending_review": sum(
            status_dict.get(status, 0) 
            for status in ["submitted", "document_review", "background_check", "officer_review"]
        ),
        "approved_today": status_dict.get("approved", 0),  # Simplified for demo
        "rejected_today": status_dict.get("rejected", 0),
        "avg_processing_days": 8.5  # Mock value
    }