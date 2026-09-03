"""The mistake notebook.

Bulk entry lives on `/tests/{id}/mistakes`, because that is where a list of
wrong answers comes from. What is here is everything after: finding one again,
retagging it, and the tag breakdown that makes the collection worth keeping.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import require_api_key
from app.db import get_db
from app.models.common import Subject
from app.models.mistakes import (
    Mistake,
    MistakeCreate,
    MistakePage,
    MistakeSummary,
    MistakeTag,
    MistakeUpdate,
)
from app.services import mistakes as mistake_service

router = APIRouter(
    prefix="/mistakes", tags=["mistakes"], dependencies=[Depends(require_api_key)]
)

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def _handle(error: mistake_service.MistakeError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("", response_model=Mistake, status_code=status.HTTP_201_CREATED)
async def create_mistake(payload: MistakeCreate) -> Mistake:
    try:
        doc = await mistake_service.create_mistake(get_db(), payload)
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return Mistake(**doc)


@router.get("/summary", response_model=MistakeSummary)
async def summary(
    date_from: str | None = Query(default=None, alias="from", pattern=DAY_PATTERN),
    date_to: str | None = Query(default=None, alias="to", pattern=DAY_PATTERN),
    subject: Subject | None = None,
) -> MistakeSummary:
    """Counts per tag and per subject over a window.

    The five tags always come back, zeroes included, so the stacked bar keeps
    its shape between visits.
    """
    result = await mistake_service.summary(
        get_db(),
        date_from=date_from,
        date_to=date_to,
        subject=subject.value if subject else None,
    )
    return MistakeSummary(**result)


@router.get("", response_model=MistakePage)
async def list_mistakes(
    tag: MistakeTag | None = None,
    subject: Subject | None = None,
    node_id: str | None = None,
    source_id: str | None = None,
    resolved: bool | None = None,
    q: str | None = Query(default=None, max_length=200),
    date_from: str | None = Query(default=None, alias="from", pattern=DAY_PATTERN),
    date_to: str | None = Query(default=None, alias="to", pattern=DAY_PATTERN),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = None,
) -> MistakePage:
    try:
        docs, next_cursor = await mistake_service.list_mistakes(
            get_db(),
            tag=tag.value if tag else None,
            subject=subject.value if subject else None,
            node_id=node_id,
            source_id=source_id,
            resolved=resolved,
            query_text=q,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            cursor=cursor,
        )
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return MistakePage(items=[Mistake(**doc) for doc in docs], next_cursor=next_cursor)


@router.get("/{mistake_id}", response_model=Mistake)
async def get_mistake(mistake_id: str) -> Mistake:
    try:
        doc = await mistake_service.get_mistake(get_db(), mistake_id)
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return Mistake(**doc)


@router.patch("/{mistake_id}", response_model=Mistake)
async def update_mistake(mistake_id: str, patch: MistakeUpdate) -> Mistake:
    try:
        doc = await mistake_service.update_mistake(get_db(), mistake_id, patch)
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return Mistake(**doc)


@router.delete("/{mistake_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mistake(mistake_id: str) -> Response:
    try:
        await mistake_service.delete_mistake(get_db(), mistake_id)
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
