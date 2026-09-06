"""The weekly to-do list.

Every write returns the whole week rather than the item it touched: the screen
is one short list, and re-rendering it from the server's copy is cheaper to
reason about than keeping a client-side copy in step.
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.auth import require_api_key
from app.db import get_db
from app.models.week import DAY_PATTERN, TodoCreate, TodoUpdate, Week
from app.services import week as week_service

router = APIRouter(prefix="/week", tags=["week"], dependencies=[Depends(require_api_key)])


def _handle(error: week_service.WeekError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("", response_model=Week)
async def read_week(start: str | None = Query(default=None, pattern=DAY_PATTERN)) -> Week:
    """This week by default. `start` may be any day inside a week — it is
    rounded back to that week's Monday."""
    return Week(**await week_service.get_week(get_db(), start=start))


@router.post("/todos", response_model=Week, status_code=201)
async def add_todo(payload: TodoCreate) -> Week:
    return Week(**await week_service.add_todo(get_db(), payload))


@router.patch("/{week_start}/todos/{todo_id}", response_model=Week)
async def update_todo(
    payload: TodoUpdate,
    week_start: str = Path(pattern=DAY_PATTERN),
    todo_id: str = Path(...),
) -> Week:
    try:
        return Week(**await week_service.update_todo(get_db(), week_start, todo_id, payload))
    except week_service.WeekError as error:
        raise _handle(error) from error


@router.delete("/{week_start}/todos/{todo_id}", response_model=Week)
async def delete_todo(
    week_start: str = Path(pattern=DAY_PATTERN),
    todo_id: str = Path(...),
) -> Week:
    try:
        return Week(**await week_service.delete_todo(get_db(), week_start, todo_id))
    except week_service.WeekError as error:
        raise _handle(error) from error
