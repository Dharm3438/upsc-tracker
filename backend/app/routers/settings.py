"""Settings and the weekly review.

The settings screen itself lands in phase 8, but the document has to exist now:
every pace figure on the Progress screen divides by study days, and study days
are exam dates minus off-days. Reading it before anything has been saved
returns the defaults rather than a 404.
"""

from fastapi import APIRouter, Depends, Query, status

from app.auth import require_api_key
from app.db import get_db
from app.models.settings import (
    AppSettings,
    SettingsUpdate,
    WeeklyReview,
    WeeklyReviewCreate,
)
from app.services import settings as settings_service

router = APIRouter(tags=["settings"], dependencies=[Depends(require_api_key)])


@router.get("/settings", response_model=AppSettings)
async def read_settings() -> AppSettings:
    return await settings_service.get_settings(get_db())


@router.patch("/settings", response_model=AppSettings)
async def patch_settings(patch: SettingsUpdate) -> AppSettings:
    """Only the fields sent are written. An explicit null on
    `weekly_off_weekday` means she has no standing day off."""
    return await settings_service.update_settings(get_db(), patch)


@router.get("/weekly-reviews", response_model=list[WeeklyReview])
async def list_weekly_reviews(
    limit: int = Query(default=12, ge=1, le=52),
) -> list[WeeklyReview]:
    """Newest first. The card shows the latest; the rest is history."""
    docs = await settings_service.list_weekly_reviews(get_db(), limit=limit)
    return [WeeklyReview(**doc) for doc in docs]


@router.post(
    "/weekly-reviews", response_model=WeeklyReview, status_code=status.HTTP_201_CREATED
)
async def create_weekly_review(payload: WeeklyReviewCreate) -> WeeklyReview:
    """Three prompts plus a snapshot of the week's numbers, taken server-side.

    Writing the same week twice edits the note and keeps the original snapshot:
    the numbers describe the week, not the moment she got round to writing
    about it.
    """
    doc = await settings_service.create_weekly_review(get_db(), payload)
    return WeeklyReview(**doc)
