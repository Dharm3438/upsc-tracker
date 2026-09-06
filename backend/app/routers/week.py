"""The weekly tracker.

One GET for the whole screen — targets, suggestion, chosen topics and the
week's numbers together — because the page is one glance and would otherwise
be four requests that can disagree with each other.

The plan is written whole rather than patched: it is four numbers and a short
list of topics.
"""

from fastapi import APIRouter, Depends, Query

from app.auth import require_api_key
from app.db import get_db
from app.models.settings import DAY_PATTERN
from app.models.week import Week, WeekPlanUpdate
from app.services import settings as settings_service
from app.services import week as week_service

router = APIRouter(tags=["week"], dependencies=[Depends(require_api_key)])


@router.get("/week", response_model=Week)
async def read_week(
    start: str | None = Query(default=None, pattern=DAY_PATTERN),
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
) -> Week:
    """This week by default. `start` may be any day inside a week — it is
    rounded back to that week's Monday."""
    db = get_db()
    settings = await settings_service.get_settings(db)
    return Week(**await week_service.get_week(db, settings, start=start, date=date))


@router.post("/week/plan", response_model=Week)
async def save_plan(payload: WeekPlanUpdate) -> Week:
    """Upsert the week's targets and chosen topics, and return the week as it
    stands afterwards."""
    db = get_db()
    settings = await settings_service.get_settings(db)
    return Week(**await week_service.save_plan(db, settings, payload))
