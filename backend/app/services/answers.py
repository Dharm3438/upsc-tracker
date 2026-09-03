"""Mains answer practice.

Writing an answer is a study action, so it leaves an `answer` log against the
node the same way a reading session does — that is what puts it on the node
timeline and into the effort chart later. The log carries the minutes, so the
timer view is the only place those are ever typed.

The redo date is recomputed on every write rather than stored by the client:
one definition of "under half", server-side.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import today_ist
from app.models.answers import AnswerCreate, AnswerUpdate, apply_redo

#: The header trends of plan §8.5.
TREND_LENGTH = 20


class AnswerError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def _oid(value: str, what: str = "answer") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise AnswerError(f"Invalid {what} id.", status=400)
    return ObjectId(value)


async def _load_node(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    node = await db.syllabus_nodes.find_one({"_id": _oid(node_id, "node")})
    if node is None:
        raise AnswerError("That topic no longer exists.", status=404)
    if node.get("is_archived"):
        raise AnswerError("That topic is archived.", status=409)
    return node


async def create_answer(
    db: AsyncIOMotorDatabase, payload: AnswerCreate
) -> dict[str, Any]:
    node = await _load_node(db, payload.node_id)

    doc = payload.model_dump(mode="json")
    doc["node_id"] = node["_id"]
    doc["subject"] = node["subject"]
    doc["reviewed"] = False
    doc["reviewed_at"] = None
    doc["created_at"] = datetime.now(UTC)
    apply_redo(doc)

    result = await db.answers.insert_one(doc)
    doc["_id"] = result.inserted_id
    await _write_log(db, doc)
    await _attach_nodes(db, [doc])
    return doc


async def _write_log(db: AsyncIOMotorDatabase, answer: dict[str, Any]) -> None:
    """The activity log entry for an answer.

    Deliberately not routed through `services.logs`: an `answer` log has no
    scheduling side-effect, and going through the log service would mean
    re-resolving the node that was just resolved here.
    """
    await db.logs.insert_one(
        {
            "node_id": answer["node_id"],
            "type": "answer",
            "date": answer["date"],
            "minutes": answer.get("minutes_taken"),
            "payload": {"answer_id": str(answer["_id"])},
            "created_at": datetime.now(UTC),
            "review_effect": None,
            "prev_review_state": None,
        }
    )


async def get_answer(db: AsyncIOMotorDatabase, answer_id: str) -> dict[str, Any]:
    doc = await db.answers.find_one({"_id": _oid(answer_id)})
    if doc is None:
        raise AnswerError("That answer is not there.", status=404)
    await _attach_nodes(db, [doc])
    return doc


async def update_answer(
    db: AsyncIOMotorDatabase, answer_id: str, patch: AnswerUpdate
) -> dict[str, Any]:
    """Apply a partial update, re-deriving the redo date from the merge.

    Scoring an answer is a patch — the timer saves it unmarked, the score sheet
    fills the rest in — so this path has to be as trustworthy as the create.
    """
    oid = _oid(answer_id)
    current = await db.answers.find_one({"_id": oid})
    if current is None:
        raise AnswerError("That answer is not there.", status=404)

    changes = patch.model_dump(mode="json", exclude_unset=True)
    if not changes:
        await _attach_nodes(db, [current])
        return current

    if changes.get("node_id"):
        node = await _load_node(db, changes["node_id"])
        changes["node_id"] = node["_id"]
        changes["subject"] = node["subject"]

    if "reviewed" in changes:
        changes["reviewed_at"] = datetime.now(UTC) if changes["reviewed"] else None

    merged = {**current, **changes}
    for field in ("self_score", "peer_score"):
        score = merged.get(field)
        if score is not None and score > merged["marks_allotted"]:
            raise AnswerError("A score cannot beat the marks allotted.")

    apply_redo(merged)
    changes["review_due"] = merged["review_due"]

    # A rewritten answer is scored again; a fresh score reopens the queue entry
    # rather than leaving it silently ticked off against the old one.
    if "reviewed" not in changes and _scoring_changed(changes):
        changes["reviewed"] = False
        changes["reviewed_at"] = None

    await db.answers.update_one({"_id": oid}, {"$set": changes})
    if _log_changed(changes):
        await _sync_log(db, oid, changes)
    return await get_answer(db, answer_id)


def _scoring_changed(changes: dict[str, Any]) -> bool:
    return bool({"self_score", "marks_allotted", "date"} & set(changes))


def _log_changed(changes: dict[str, Any]) -> bool:
    return bool({"date", "minutes_taken", "node_id"} & set(changes))


async def _sync_log(
    db: AsyncIOMotorDatabase, oid: ObjectId, changes: dict[str, Any]
) -> None:
    """Keep the answer's log row in step with the answer.

    Without this, correcting the date on an answer would leave the timeline
    showing it on the day she first typed it in.
    """
    update = {
        key: changes[key]
        for key in ("date", "node_id")
        if key in changes
    }
    if "minutes_taken" in changes:
        update["minutes"] = changes["minutes_taken"]
    await db.logs.update_one(
        {"type": "answer", "payload.answer_id": str(oid)}, {"$set": update}
    )


async def delete_answer(db: AsyncIOMotorDatabase, answer_id: str) -> None:
    """Delete an answer, its log entry, and the mistakes recorded against it.

    The mistakes go with it for the reason a test's do: a mistake means "this
    came out of that", and an orphan distorts the tag breakdown.
    """
    oid = _oid(answer_id)
    result = await db.answers.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise AnswerError("That answer is already gone.", status=404)
    await db.logs.delete_many({"type": "answer", "payload.answer_id": str(oid)})
    await db.mistakes.delete_many({"source_type": "answer", "source_id": oid})


async def list_answers(
    db: AsyncIOMotorDatabase,
    *,
    subject: str | None = None,
    node_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 30,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """A page of answers, newest first.

    Sorted on `_id` rather than `date` for the reason the tests list is: three
    answers written on one Sunday would otherwise share a sort key, and a page
    boundary between them could drop a row.
    """
    query: dict[str, Any] = {}
    if subject:
        query["subject"] = subject
    if node_id:
        query["node_id"] = _oid(node_id, "node")
    if date_from or date_to:
        span: dict[str, str] = {}
        if date_from:
            span["$gte"] = date_from
        if date_to:
            span["$lte"] = date_to
        query["date"] = span
    if cursor:
        query["_id"] = {"$lt": _oid(cursor, "cursor")}

    docs = await db.answers.find(query).sort([("_id", -1)]).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = str(docs[-1]["_id"]) if has_more and docs else None

    await _attach_nodes(db, docs)
    return docs, next_cursor


async def review_queue(
    db: AsyncIOMotorDatabase, *, today: str | None = None, limit: int = 20
) -> list[dict[str, Any]]:
    """Answers she scored under half whose thirty days are up.

    Oldest first: the one that has been waiting longest is the one to rewrite.
    """
    day = today or today_ist()
    docs = await (
        db.answers.find(
            {"review_due": {"$ne": None, "$lte": day}, "reviewed": False}
        )
        .sort([("review_due", 1), ("_id", 1)])
        .to_list(length=limit)
    )
    await _attach_nodes(db, docs)
    return docs


async def _attach_nodes(db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]) -> None:
    """One extra query for a whole page. Titles are joined rather than stored,
    so a renamed topic is renamed everywhere it shows."""
    if not docs:
        return
    node_ids = list({doc["node_id"] for doc in docs})
    nodes = await db.syllabus_nodes.find(
        {"_id": {"$in": node_ids}}, {"title": 1, "path": 1}
    ).to_list(length=None)
    by_id = {node["_id"]: node for node in nodes}
    for doc in docs:
        node = by_id.get(doc["node_id"])
        if node:
            doc["node_title"] = node["title"]
            doc["node_path"] = node["path"]


async def trends(
    db: AsyncIOMotorDatabase, length: int = TREND_LENGTH
) -> dict[str, Any]:
    """Average minutes and average self-score over the last few answers.

    The two series are independent: an answer written on the timer but not yet
    scored belongs in the minutes trend and not in the score one, and dropping
    it from both would make the timer look unused.
    """
    docs = await (
        db.answers.find({}, {"minutes_taken": 1, "self_score": 1, "marks_allotted": 1})
        .sort([("_id", -1)])
        .to_list(length=length)
    )
    docs.reverse()

    minutes = [
        doc["minutes_taken"] for doc in docs if doc.get("minutes_taken") is not None
    ]
    scores = [
        round(doc["self_score"] / doc["marks_allotted"], 4)
        for doc in docs
        if doc.get("self_score") is not None and doc.get("marks_allotted")
    ]

    return {
        "count": len(docs),
        "average_minutes": round(sum(minutes) / len(minutes), 1) if minutes else None,
        "average_score": round(sum(scores) / len(scores), 4) if scores else None,
        "minutes": minutes,
        "scores": scores,
    }
