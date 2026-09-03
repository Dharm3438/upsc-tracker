"""The Progress screen's reads.

All five are derived: nothing here writes, and every one of them takes the
settings document first, because the exam dates and the off-days are what turn
a raw count into a pace.
"""

from fastapi import APIRouter, Depends, Query

from app.auth import require_api_key
from app.db import get_db
from app.models.common import Subject
from app.models.progress import Burndown, Countdown, Coverage, Effort, Heatmap
from app.services import progress as progress_service
from app.services import settings as settings_service

router = APIRouter(
    prefix="/progress", tags=["progress"], dependencies=[Depends(require_api_key)]
)

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


@router.get("/countdown", response_model=Countdown)
async def countdown(
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Countdown:
    """Days to each exam, and the effective study days inside them."""
    db = get_db()
    settings = await settings_service.get_settings(db)
    return Countdown(**await progress_service.countdown(db, settings, date=date))


@router.get("/burndown", response_model=Burndown)
async def burndown(
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Burndown:
    """Topics remaining against the pace needed to clear them before Prelims."""
    db = get_db()
    settings = await settings_service.get_settings(db)
    return Burndown(**await progress_service.burndown(db, settings, date=date))


@router.get("/coverage", response_model=Coverage)
async def coverage(
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Coverage:
    """Per subject: leaves read, revised twice, and tested."""
    return Coverage(**await progress_service.coverage(get_db(), date=date))


@router.get("/heatmap", response_model=Heatmap)
async def heatmap(
    subject: Subject | None = None,
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Heatmap:
    """Every leaf as a square, grouped by section, coloured by confidence."""
    result = await progress_service.heatmap(
        get_db(), subject=subject.value if subject else None, date=date
    )
    return Heatmap(**result)


@router.get("/streakless-summary", response_model=Effort)
async def streakless_summary(
    days: int = Query(default=30, ge=7, le=120),
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Effort:
    """Study minutes and log counts per day, with off-days marked.

    Named for what it deliberately is not: there is no streak here to break.
    """
    db = get_db()
    settings = await settings_service.get_settings(db)
    return Effort(**await progress_service.effort(db, settings, days=days, date=date))
