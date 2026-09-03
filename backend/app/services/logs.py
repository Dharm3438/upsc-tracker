"""Writes and reads against the activity log.

The interesting part is not the insert, it is the side-effects. A `read` starts
a node's revision schedule; a `revise` grades it through SM-2. Both have to be
reversible, because the delete endpoint exists to undo a mis-tap and SM-2 is
not an invertible function — you cannot recompute the previous ease from the
new one. So every log that touched `review_state` carries a snapshot of what
that state looked like beforehand, and deleting the log restores the snapshot.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import days_between, today_ist
from app.models.logs import SCHEDULING_TYPES, LogCreate, LogType
from app.services import sm2

log = logging.getLogger(__name__)

RECENT_NODE_LIMIT = 8

#: How far back `recent_nodes` scans. A week of real logging is nowhere near
#: this, and it stops a two-year history meaning a full collection scan.
RECENT_SCAN_LIMIT = 400


class LogError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


async def _load_node(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    node = await db.syllabus_nodes.find_one({"_id": ObjectId(node_id)})
    if node is None:
        raise LogError("That topic no longer exists.", status=404)
    if node.get("is_archived"):
        raise LogError("That topic is archived.", status=409)
    return node


async def _compression_factor(db: AsyncIOMotorDatabase, today: str) -> float:
    """Read the Prelims date to decide whether intervals are being compressed.

    Settings do not exist until phase 8, so a missing document simply means no
    compression rather than an error.
    """
    settings = await db.app_settings.find_one({"_id": "singleton"})
    prelims = (settings or {}).get("prelims_date")
    if not prelims:
        return 1.0
    try:
        return sm2.compression_for(days_between(today, prelims))
    except ValueError:
        log.warning("prelims_date is not a study day: %r", prelims)
        return 1.0


def _state_from_doc(doc: dict[str, Any] | None) -> sm2.ReviewState | None:
    if doc is None:
        return None
    return sm2.ReviewState(
        repetitions=doc.get("repetitions", 0),
        ease_factor=doc.get("ease_factor", sm2.INITIAL_EASE),
        interval_days=doc.get("interval_days", 0),
        lapses=doc.get("lapses", 0),
    )


def _snapshot(previous: dict[str, Any] | None) -> dict[str, Any] | None:
    """The stored form of a prior review state: everything but its _id, so
    restoring it on delete is a plain replace."""
    if previous is None:
        return None
    return {key: value for key, value in previous.items() if key != "_id"}


async def create_log(
    db: AsyncIOMotorDatabase, payload: LogCreate
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Insert a log and apply its side-effect. Returns (log, review_state)."""
    node = await _load_node(db, payload.node_id)
    node_oid = node["_id"]

    doc: dict[str, Any] = {
        "node_id": node_oid,
        "type": payload.type.value,
        "date": payload.date,
        "minutes": payload.minutes,
        "payload": payload.payload,
        "created_at": datetime.now(UTC),
        # Both set below when the log actually reschedules the node.
        "review_effect": None,
        "prev_review_state": None,
    }

    state_doc: dict[str, Any] | None = None
    if payload.type in SCHEDULING_TYPES:
        previous = await db.review_state.find_one({"node_id": node_oid})
        state_doc, effect = await _apply_schedule(db, node, payload, previous)
        if effect is not None:
            doc["review_effect"] = effect
            doc["prev_review_state"] = _snapshot(previous)

    result = await db.logs.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc, state_doc


async def _apply_schedule(
    db: AsyncIOMotorDatabase,
    node: dict[str, Any],
    payload: LogCreate,
    previous: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Run the scheduling side-effect for a `read` or `revise` log.

    Returns the new state and what happened to it, where `None` means the log
    left the schedule alone and so has nothing to reverse on delete.
    """
    node_oid = node["_id"]

    if payload.type is LogType.READ:
        # Re-reading a tracked node is not a grading event and must not push
        # the next revision out. Only a first read starts the schedule.
        if previous is not None:
            return previous, None
        result = sm2.first_read(payload.date)
        confidence = payload.payload.get("confidence")
    else:
        confidence = payload.payload["confidence"]
        result = sm2.schedule(
            _state_from_doc(previous),
            confidence,
            today=payload.date,
            pyq_weight=node.get("pyq_weight", "medium"),
            compression_factor=await _compression_factor(db, payload.date),
        )

    state = {
        "node_id": node_oid,
        "repetitions": result.repetitions,
        "ease_factor": result.ease_factor,
        "interval_days": result.interval_days,
        "last_reviewed": payload.date,
        "next_due": result.next_due,
        "last_confidence": confidence,
        "lapses": result.lapses,
    }
    await db.review_state.replace_one({"node_id": node_oid}, state, upsert=True)
    return state, "created" if previous is None else "updated"


async def delete_log(db: AsyncIOMotorDatabase, log_id: str) -> None:
    """Remove a log and undo whatever it did to the revision schedule.

    Refused when a later log has since rescheduled the same node: restoring an
    older snapshot over a newer one would silently throw away that newer
    grading. Undo is for the tap she just made.
    """
    if not ObjectId.is_valid(log_id):
        raise LogError("Invalid log id.", status=400)
    doc = await db.logs.find_one({"_id": ObjectId(log_id)})
    if doc is None:
        raise LogError("That entry is already gone.", status=404)

    if doc.get("review_effect"):
        newer = await db.logs.count_documents(
            {
                "node_id": doc["node_id"],
                "review_effect": {"$ne": None},
                "created_at": {"$gt": doc["created_at"]},
            }
        )
        if newer:
            raise LogError(
                "Delete the newer entry on this topic first — otherwise this "
                "would undo that one's scheduling too.",
                status=409,
            )

        snapshot = doc.get("prev_review_state")
        if snapshot is None:
            await db.review_state.delete_one({"node_id": doc["node_id"]})
        else:
            await db.review_state.replace_one(
                {"node_id": doc["node_id"]}, snapshot, upsert=True
            )

    await db.logs.delete_one({"_id": doc["_id"]})


async def list_logs(
    db: AsyncIOMotorDatabase,
    *,
    node_id: str | None = None,
    log_type: LogType | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
    with_node: bool = False,
) -> tuple[list[dict[str, Any]], str | None]:
    """A page of logs, newest first.

    Paged on `_id` rather than an offset: ObjectIds are monotonic, so a log
    written while she scrolls cannot shift the page boundary and hide a row.
    """
    query: dict[str, Any] = {}
    if node_id:
        if not ObjectId.is_valid(node_id):
            raise LogError("Invalid node id.", status=400)
        query["node_id"] = ObjectId(node_id)
    if log_type:
        # Accepts the enum from the router or a bare string from a caller.
        query["type"] = LogType(log_type).value
    if date_from or date_to:
        span: dict[str, str] = {}
        if date_from:
            span["$gte"] = date_from
        if date_to:
            span["$lte"] = date_to
        query["date"] = span
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise LogError("Invalid cursor.", status=400)
        query["_id"] = {"$lt": ObjectId(cursor)}

    # One extra row tells us whether a further page exists, without a count().
    docs = await db.logs.find(query).sort([("_id", -1)]).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = str(docs[-1]["_id"]) if has_more and docs else None

    if with_node and docs:
        await _attach_nodes(db, docs)
    return docs, next_cursor


async def _attach_nodes(db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]) -> None:
    """Decorate logs with their node's title and path in one extra query."""
    ids = list({doc["node_id"] for doc in docs})
    nodes = await db.syllabus_nodes.find(
        {"_id": {"$in": ids}}, {"title": 1, "path": 1}
    ).to_list(length=None)
    by_id = {node["_id"]: node for node in nodes}
    for doc in docs:
        node = by_id.get(doc["node_id"])
        if node:
            doc["node_title"] = node["title"]
            doc["node_path"] = node["path"]


async def recent_nodes(
    db: AsyncIOMotorDatabase, limit: int = RECENT_NODE_LIMIT
) -> list[dict[str, Any]]:
    """The last distinct nodes logged against, newest first.

    This is the whole reason logging can stay under 15 seconds: on most days the
    topic she wants is already on screen, so there is no search step.
    """
    pipeline: list[dict[str, Any]] = [
        {"$sort": {"_id": -1}},
        {"$limit": RECENT_SCAN_LIMIT},
        {
            "$group": {
                "_id": "$node_id",
                "last_logged": {"$max": "$date"},
                "recency": {"$max": "$_id"},
            }
        },
        {"$sort": {"recency": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "syllabus_nodes",
                "localField": "_id",
                "foreignField": "_id",
                "as": "node",
            }
        },
        {"$unwind": "$node"},
        {"$match": {"node.is_archived": False}},
        {
            "$project": {
                "_id": 0,
                "node_id": "$_id",
                "title": "$node.title",
                "path": "$node.path",
                "subject": "$node.subject",
                "last_logged": 1,
            }
        },
    ]
    return await db.logs.aggregate(pipeline).to_list(length=limit)


async def timeline_summary(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    """Counts and total minutes for one node — the node detail header."""
    if not ObjectId.is_valid(node_id):
        raise LogError("Invalid node id.", status=400)
    pipeline: list[dict[str, Any]] = [
        {"$match": {"node_id": ObjectId(node_id)}},
        {
            "$group": {
                "_id": "$type",
                "n": {"$sum": 1},
                "minutes": {"$sum": {"$ifNull": ["$minutes", 0]}},
            }
        },
    ]
    rows = await db.logs.aggregate(pipeline).to_list(length=None)
    return {
        "counts": {row["_id"]: row["n"] for row in rows},
        "minutes": sum(row["minutes"] for row in rows),
        "today": today_ist(),
    }
