"""Current affairs.

Standard CRUD plus the two reads the screens are built around: the inbox of
untagged items, and the list of months that actually have items in them.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import require_api_key
from app.db import get_db
from app.models.ca import CaCreate, CaItem, CaMonth, CaPage, CaUpdate
from app.models.common import Paper
from app.services import ca as ca_service

router = APIRouter(prefix="/ca", tags=["ca"], dependencies=[Depends(require_api_key)])

MONTH_PATTERN = r"^\d{4}-\d{2}$"


def _handle(error: ca_service.CaError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


class CaInbox(CaPage):
    """The inbox carries its own total: the Today row shows how many are
    waiting, which is not the same as how many fit on one page."""

    total: int = 0


@router.post("", response_model=CaItem, status_code=status.HTTP_201_CREATED)
async def create_item(payload: CaCreate) -> CaItem:
    """Capture an item. A headline is enough; the topic can come later."""
    try:
        doc = await ca_service.create_item(get_db(), payload)
    except ca_service.CaError as error:
        raise _handle(error) from error
    return CaItem(**doc)


@router.get("", response_model=CaPage)
async def list_items(
    month: str | None = Query(default=None, pattern=MONTH_PATTERN),
    node_id: str | None = None,
    paper: Paper | None = None,
    tagged: bool | None = None,
    starred: bool | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    cursor: str | None = None,
) -> CaPage:
    """Items, newest first. Filter by month for magazine revision, or by node
    to pull everything current before revising that topic."""
    try:
        docs, next_cursor = await ca_service.list_items(
            get_db(),
            month=month,
            node_id=node_id,
            paper=paper.value if paper else None,
            tagged=tagged,
            starred=starred,
            limit=limit,
            cursor=cursor,
        )
    except ca_service.CaError as error:
        raise _handle(error) from error
    return CaPage(items=[CaItem(**doc) for doc in docs], next_cursor=next_cursor)


@router.get("/inbox", response_model=CaInbox)
async def inbox(limit: int = Query(default=50, ge=1, le=100)) -> CaInbox:
    """Items with no topic yet, oldest first."""
    docs, total = await ca_service.inbox(get_db(), limit=limit)
    return CaInbox(items=[CaItem(**doc) for doc in docs], total=total)


@router.get("/months", response_model=list[CaMonth])
async def months() -> list[CaMonth]:
    """Months that have items, newest first — the month filter's options."""
    return [CaMonth(**row) for row in await ca_service.months(get_db())]


@router.get("/{item_id}", response_model=CaItem)
async def get_item(item_id: str) -> CaItem:
    try:
        doc = await ca_service.get_item(get_db(), item_id)
    except ca_service.CaError as error:
        raise _handle(error) from error
    return CaItem(**doc)


@router.patch("/{item_id}", response_model=CaItem)
async def update_item(item_id: str, patch: CaUpdate) -> CaItem:
    """Tagging from the inbox comes through here: send a node to tag it, or an
    explicit null to send it back to the inbox."""
    try:
        doc = await ca_service.update_item(get_db(), item_id, patch)
    except ca_service.CaError as error:
        raise _handle(error) from error
    return CaItem(**doc)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str) -> Response:
    """Deletes the item and the log its tagging left on the node timeline."""
    try:
        await ca_service.delete_item(get_db(), item_id)
    except ca_service.CaError as error:
        raise _handle(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
