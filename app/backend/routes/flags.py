"""Flag catalog endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services.review_flags import get_flag_catalog

router = APIRouter()


@router.get("/catalog")
async def flag_catalog(db: Session = Depends(get_db)):
    """Return flag categories, decision categories, and the compatibility matrix."""
    return get_flag_catalog(db)
