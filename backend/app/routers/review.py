"""The revision queue.

Read-only. Grading a topic is a `revise` log, so it goes through POST /logs and
its side-effect, and there is deliberately no second way to move the schedule.
"""

from fastapi import APIRouter, Depends, Query

from app.auth import require_api_key
from app.db import get_db
from app.models.review import DueList, DueNode, Upcoming, UpcomingDay
from app.services import review as review_service

router = APIRouter(
    prefix="/review", tags=["review"], dependencies=[Depends(require_api_key)]
)

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


@router.get("/due", response_model=DueList)
async def due(
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
    limit: int = Query(default=review_service.DEFAULT_DUE_LIMIT, ge=1, le=200),
) -> DueList:
    """What is due today: weakest first, then whatever UPSC asks about most.

    `date` exists so a forecast day can be opened as a list; left out, it means
    today in IST.
    """
    result = await review_service.due(get_db(), date=date, limit=limit)
    return DueList(
        date=result["date"],
        total=result["total"],
        items=[DueNode(**row) for row in result["items"]],
    )


@router.get("/upcoming", response_model=Upcoming)
async def upcoming(
    date: str | None = Query(default=None, pattern=DAY_PATTERN),
    days: int = Query(default=review_service.DEFAULT_FORECAST_DAYS, ge=1, le=60),
) -> Upcoming:
    """Counts per day for the forecast bar."""
    result = await review_service.upcoming(get_db(), date=date, days=days)
    return Upcoming(
        date=result["date"],
        overdue=result["overdue"],
        days=[UpcomingDay(**row) for row in result["days"]],
    )
