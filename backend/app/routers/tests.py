"""Test attempts.

Standard CRUD, plus the one endpoint that matters after a mock: bulk-adding the
wrong questions with their tags in a single write.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import require_api_key
from app.db import get_db
from app.models.common import Subject
from app.models.mistakes import Mistake, MistakeBulk
from app.models.tests import Test, TestCreate, TestKind, TestPage, TestUpdate
from app.services import mistakes as mistake_service
from app.services import tests as test_service

router = APIRouter(prefix="/tests", tags=["tests"], dependencies=[Depends(require_api_key)])


def _handle(error: test_service.TestError | mistake_service.MistakeError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("", response_model=Test, status_code=status.HTTP_201_CREATED)
async def create_test(payload: TestCreate) -> Test:
    """Record an attempt. Wrong, skipped, accuracy and the score are derived."""
    try:
        doc = await test_service.create_test(get_db(), payload)
    except test_service.TestError as error:
        raise _handle(error) from error
    return Test(**doc)


@router.get("", response_model=TestPage)
async def list_tests(
    kind: TestKind | None = None,
    subject: Subject | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    cursor: str | None = None,
) -> TestPage:
    """Attempts, newest first, with the accuracy trend for the header."""
    db = get_db()
    try:
        docs, next_cursor = await test_service.list_tests(
            db,
            kind=kind.value if kind else None,
            subject=subject.value if subject else None,
            limit=limit,
            cursor=cursor,
        )
    except test_service.TestError as error:
        raise _handle(error) from error

    # The sparkline is the last ten attempts overall, not the last ten on the
    # current page — it is a trend, and it should not move when she scrolls.
    trend = await test_service.accuracy_trend(db) if cursor is None else []
    return TestPage(
        items=[Test(**doc) for doc in docs], next_cursor=next_cursor, trend=trend
    )


@router.get("/{test_id}", response_model=Test)
async def get_test(test_id: str) -> Test:
    try:
        doc = await test_service.get_test(get_db(), test_id)
    except test_service.TestError as error:
        raise _handle(error) from error
    return Test(**doc)


@router.patch("/{test_id}", response_model=Test)
async def update_test(test_id: str, patch: TestUpdate) -> Test:
    try:
        doc = await test_service.update_test(get_db(), test_id, patch)
    except test_service.TestError as error:
        raise _handle(error) from error
    return Test(**doc)


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(test_id: str) -> Response:
    """Deletes the attempt and the mistakes recorded against it."""
    try:
        await test_service.delete_test(get_db(), test_id)
    except test_service.TestError as error:
        raise _handle(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{test_id}/mistakes",
    response_model=list[Mistake],
    status_code=status.HTTP_201_CREATED,
)
async def add_mistakes(test_id: str, payload: MistakeBulk) -> list[Mistake]:
    """The whole wrong-answer list from one subject, in one request."""
    try:
        docs = await mistake_service.add_test_mistakes(get_db(), test_id, payload)
    except mistake_service.MistakeError as error:
        raise _handle(error) from error
    return [Mistake(**doc) for doc in docs]
