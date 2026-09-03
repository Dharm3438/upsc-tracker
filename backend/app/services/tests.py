"""Test attempts.

The derived fields live here and nowhere else. `wrong`, `skipped`, `accuracy`
and — unless she overrides it — `marks` are all functions of the three numbers
on the score sheet, so recomputing them on every write is both cheaper and
safer than trusting a client to keep four numbers consistent with each other.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.tests import NEGATIVE_FRACTION, TestCreate, TestUpdate

#: The header sparkline, per plan §8.4.
TREND_LENGTH = 10


class TestError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def _oid(value: str, what: str = "test") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise TestError(f"Invalid {what} id.", status=400)
    return ObjectId(value)


def derive(doc: dict[str, Any]) -> dict[str, Any]:
    """Fill in everything that follows from total / attempted / correct."""
    total = doc["total_questions"]
    attempted = doc["attempted"]
    correct = doc["correct"]

    doc["wrong"] = attempted - correct
    doc["skipped"] = total - attempted
    doc["accuracy"] = round(correct / attempted, 4) if attempted else 0.0

    per_question = (doc["max_marks"] / total) if doc.get("max_marks") else None
    penalty = doc.get("negative_per_wrong")
    if penalty is None and per_question is not None:
        penalty = round(per_question * NEGATIVE_FRACTION, 2)
    doc["negative_per_wrong"] = penalty

    # A stated score wins: bonus marks and dropped questions are real, and the
    # arithmetic cannot know about them.
    if doc.get("marks") is None and per_question is not None:
        doc["marks"] = round(correct * per_question - doc["wrong"] * (penalty or 0), 2)
    return doc


async def create_test(db: AsyncIOMotorDatabase, payload: TestCreate) -> dict[str, Any]:
    doc = payload.model_dump(mode="json")
    doc["created_at"] = datetime.now(UTC)
    derive(doc)
    result = await db.tests.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["mistakes_logged"] = 0
    return doc


async def get_test(db: AsyncIOMotorDatabase, test_id: str) -> dict[str, Any]:
    doc = await db.tests.find_one({"_id": _oid(test_id)})
    if doc is None:
        raise TestError("That test is not there.", status=404)
    doc["mistakes_logged"] = await db.mistakes.count_documents(
        {"source_id": doc["_id"]}
    )
    return doc


async def update_test(
    db: AsyncIOMotorDatabase, test_id: str, patch: TestUpdate
) -> dict[str, Any]:
    """Apply a partial update, re-deriving from the merged document.

    The counts are validated against the merge rather than the patch: raising
    `correct` on its own is only wrong in the light of the `attempted` already
    stored.
    """
    oid = _oid(test_id)
    current = await db.tests.find_one({"_id": oid})
    if current is None:
        raise TestError("That test is not there.", status=404)

    changes = patch.model_dump(mode="json", exclude_unset=True)
    if not changes:
        return await get_test(db, test_id)

    merged = {**current, **changes}
    if merged["attempted"] > merged["total_questions"]:
        raise TestError("More attempted than the subject had.")
    if merged["correct"] > merged["attempted"]:
        raise TestError("More correct than attempted.")

    # An edited count has to be allowed to move the score back onto the
    # arithmetic; only a marks value sent in this very patch is treated as
    # deliberate.
    if "marks" not in changes and _counts_changed(changes):
        merged["marks"] = None
    if "negative_per_wrong" not in changes and "max_marks" in changes:
        merged["negative_per_wrong"] = None

    merged.pop("_id", None)
    merged.pop("mistakes_logged", None)
    derive(merged)
    await db.tests.update_one({"_id": oid}, {"$set": merged})
    return await get_test(db, test_id)


def _counts_changed(changes: dict[str, Any]) -> bool:
    return bool(
        {"total_questions", "attempted", "correct", "max_marks"} & set(changes)
    )


async def delete_test(db: AsyncIOMotorDatabase, test_id: str) -> None:
    """Delete an attempt and the mistakes recorded against it.

    The mistakes go with it deliberately: a mistake's whole meaning is "this
    came out of that subject", and orphans would silently distort the tag
    breakdown, which is the one number this app is supposed to get right.
    """
    oid = _oid(test_id)
    result = await db.tests.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise TestError("That test is already gone.", status=404)
    await db.mistakes.delete_many({"source_type": "mcq", "source_id": oid})


async def list_tests(
    db: AsyncIOMotorDatabase,
    *,
    kind: str | None = None,
    subject: str | None = None,
    limit: int = 30,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """A page of attempts, newest first.

    Sorted on `_id` rather than `date` so the cursor is stable: two mocks on
    one Sunday would otherwise share a sort key and a page boundary between
    them could drop a row.
    """
    query: dict[str, Any] = {}
    if kind:
        query["kind"] = kind
    if subject:
        query["subjects"] = subject
    if cursor:
        query["_id"] = {"$lt": _oid(cursor, "cursor")}

    docs = await db.tests.find(query).sort([("_id", -1)]).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = str(docs[-1]["_id"]) if has_more and docs else None

    await _attach_mistake_counts(db, docs)
    return docs, next_cursor


async def _attach_mistake_counts(
    db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]
) -> None:
    """One grouped query for the page, not one count per row."""
    if not docs:
        return
    ids = [doc["_id"] for doc in docs]
    rows = await db.mistakes.aggregate(
        [
            {"$match": {"source_id": {"$in": ids}}},
            {"$group": {"_id": "$source_id", "n": {"$sum": 1}}},
        ]
    ).to_list(length=None)
    counts = {row["_id"]: row["n"] for row in rows}
    for doc in docs:
        doc["mistakes_logged"] = counts.get(doc["_id"], 0)


async def accuracy_trend(
    db: AsyncIOMotorDatabase, length: int = TREND_LENGTH
) -> list[float]:
    """The last few accuracies, oldest first, so the sparkline reads left to
    right the way time does. Unattempted subjects are left out — a zero there is
    not a dip in accuracy, it is an absence of data."""
    docs = await (
        db.tests.find({"attempted": {"$gt": 0}}, {"accuracy": 1})
        .sort([("_id", -1)])
        .to_list(length=length)
    )
    return [doc.get("accuracy", 0.0) for doc in reversed(docs)]
