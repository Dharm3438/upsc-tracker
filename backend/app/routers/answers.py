"""Mains answer practice.

Standard CRUD plus the redo queue — answers she scored under half whose thirty
days are up.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import require_api_key
from app.db import get_db
from app.models.answers import (
    Answer,
    AnswerCreate,
    AnswerPage,
    AnswerTrends,
    AnswerUpdate,
)
from app.models.common import Paper
from app.services import answers as answer_service

router = APIRouter(
    prefix="/answers", tags=["answers"], dependencies=[Depends(require_api_key)]
)

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def _handle(error: answer_service.AnswerError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("", response_model=Answer, status_code=status.HTTP_201_CREATED)
async def create_answer(payload: AnswerCreate) -> Answer:
    """Record an attempt. Writes the node's `answer` log and sets the redo date."""
    try:
        doc = await answer_service.create_answer(get_db(), payload)
    except answer_service.AnswerError as error:
        raise _handle(error) from error
    return Answer(**doc)


@router.get("", response_model=AnswerPage)
async def list_answers(
    paper: Paper | None = None,
    node_id: str | None = None,
    date_from: str | None = Query(default=None, pattern=DAY_PATTERN),
    date_to: str | None = Query(default=None, pattern=DAY_PATTERN),
    limit: int = Query(default=30, ge=1, le=100),
    cursor: str | None = None,
) -> AnswerPage:
    """Answers, newest first, with the two header trends."""
    db = get_db()
    try:
        docs, next_cursor = await answer_service.list_answers(
            db,
            paper=paper.value if paper else None,
            node_id=node_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            cursor=cursor,
        )
    except answer_service.AnswerError as error:
        raise _handle(error) from error

    # The trends are the last twenty answers overall, not the last twenty on
    # this page — they should not move when she scrolls.
    computed = await answer_service.trends(db) if cursor is None else {}
    return AnswerPage(
        items=[Answer(**doc) for doc in docs],
        next_cursor=next_cursor,
        trends=AnswerTrends(**computed),
    )


@router.get("/review-queue", response_model=list[Answer])
async def review_queue(limit: int = Query(default=20, ge=1, le=100)) -> list[Answer]:
    """The redo queue: scored under half, thirty days up, not yet rewritten."""
    docs = await answer_service.review_queue(get_db(), limit=limit)
    return [Answer(**doc) for doc in docs]


@router.get("/{answer_id}", response_model=Answer)
async def get_answer(answer_id: str) -> Answer:
    try:
        doc = await answer_service.get_answer(get_db(), answer_id)
    except answer_service.AnswerError as error:
        raise _handle(error) from error
    return Answer(**doc)


@router.patch("/{answer_id}", response_model=Answer)
async def update_answer(answer_id: str, patch: AnswerUpdate) -> Answer:
    """Scoring an answer comes through here, so the redo date is re-derived."""
    try:
        doc = await answer_service.update_answer(get_db(), answer_id, patch)
    except answer_service.AnswerError as error:
        raise _handle(error) from error
    return Answer(**doc)


@router.delete("/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(answer_id: str) -> Response:
    """Deletes the answer, its log entry, and its mistakes."""
    try:
        await answer_service.delete_answer(get_db(), answer_id)
    except answer_service.AnswerError as error:
        raise _handle(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
