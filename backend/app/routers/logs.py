"""Activity logging.

One endpoint takes every kind of study action, because the sheet that calls it
is one sheet. The type decides the payload and the side-effect; see
`services/logs.py` for why deletes carry a snapshot.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import require_api_key
from app.db import get_db
from app.models.logs import (
    Log,
    LogCreate,
    LogCreated,
    LogPage,
    LogType,
    RecentNode,
    ReviewStateOut,
)
from app.services import cache
from app.services import logs as log_service

router = APIRouter(prefix="/logs", tags=["logs"], dependencies=[Depends(require_api_key)])

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def _handle(error: log_service.LogError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("", response_model=LogCreated, status_code=status.HTTP_201_CREATED)
async def create_log(payload: LogCreate) -> LogCreated:
    """Record a study action.

    The response carries the resulting review state so the confirmation toast
    can say "back on 23 Sep" without a second round trip.
    """
    try:
        doc, state = await log_service.create_log(get_db(), payload)
    except log_service.LogError as error:
        raise _handle(error) from error

    # The row's counts and its next-due date both just changed.
    cache.invalidate()
    review_state = ReviewStateOut(**state) if state else None
    return LogCreated(
        log=Log(**doc),
        review_state=review_state,
        next_due=review_state.next_due if review_state else None,
    )


@router.get("/recent-nodes", response_model=list[RecentNode])
async def recent_nodes(limit: int = Query(default=8, ge=1, le=20)) -> list[RecentNode]:
    """The shortcut row on the quick log sheet."""
    rows = await log_service.recent_nodes(get_db(), limit)
    return [RecentNode(**row) for row in rows]


@router.get("", response_model=LogPage)
async def list_logs(
    node_id: str | None = None,
    type: LogType | None = None,
    date_from: str | None = Query(default=None, alias="from", pattern=DAY_PATTERN),
    date_to: str | None = Query(default=None, alias="to", pattern=DAY_PATTERN),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = None,
) -> LogPage:
    """Timeline, newest first. Without `node_id` this is the whole history."""
    try:
        docs, next_cursor = await log_service.list_logs(
            get_db(),
            node_id=node_id,
            log_type=type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            cursor=cursor,
            # A single node's timeline already knows which node it is.
            with_node=node_id is None,
        )
    except log_service.LogError as error:
        raise _handle(error) from error
    return LogPage(items=[Log(**doc) for doc in docs], next_cursor=next_cursor)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(log_id: str) -> Response:
    """Undo a mis-tap, rolling back the revision schedule with it."""
    try:
        await log_service.delete_log(get_db(), log_id)
    except log_service.LogError as error:
        raise _handle(error) from error
    cache.invalidate()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
