"""Per-node statistics for the syllabus tree.

The tree row shows what has happened to a topic without the UI asking per node
— that would be several hundred requests for GEOGRAPHY alone. So the whole subject's
statistics come back in two aggregations: one over `logs`, one over
`review_state`.
"""

from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def _sum_when(log_type: str, field: str | None = None) -> dict[str, Any]:
    """Count logs of one type, or total one of their payload fields."""
    value: Any = 1 if field is None else {"$ifNull": [f"$payload.{field}", 0]}
    return {"$sum": {"$cond": [{"$eq": ["$type", log_type]}, value, 0]}}


#: Shared by the per-subject and per-node rollups so the two can never drift.
_GROUP_STAGE: dict[str, Any] = {
    "$group": {
        "_id": "$node_id",
        "read_count": _sum_when("read"),
        "revise_count": _sum_when("revise"),
        "mcq_attempted": _sum_when("mcq", "attempted"),
        "mcq_correct": _sum_when("mcq", "correct"),
        "last_touched": {"$max": "$date"},
    }
}


def _from_log_row(row: dict[str, Any]) -> dict[str, Any]:
    attempted = row["mcq_attempted"]
    return {
        "read_count": row["read_count"],
        "revise_count": row["revise_count"],
        "mcq_accuracy": (row["mcq_correct"] / attempted) if attempted else None,
        "last_touched": row["last_touched"],
    }


async def node_stats(db: AsyncIOMotorDatabase, node_id: ObjectId) -> dict[str, Any]:
    """The same statistics as `subject_stats`, for a single node.

    Used by the node detail screen, which needs the counts and the next-due
    date but has no reason to load the rest of its subject.
    """
    stats: dict[str, Any] = {}
    async for row in db.logs.aggregate([{"$match": {"node_id": node_id}}, _GROUP_STAGE]):
        stats = _from_log_row(row)

    state = await db.review_state.find_one({"node_id": node_id})
    if state:
        stats["next_due"] = state.get("next_due")
        stats["confidence"] = state.get("last_confidence")
    return stats


async def subject_stats(
    db: AsyncIOMotorDatabase, subject: str
) -> dict[str, dict[str, Any]]:
    """Own statistics per node for one subject, keyed by node id as a string.

    "Own" meaning logs attached to that exact node. Rolling those up the tree is
    the tree builder's job, since only it knows the shape.
    """
    node_ids = await db.syllabus_nodes.distinct("_id", {"subject": subject})
    if not node_ids:
        return {}

    stats: dict[str, dict[str, Any]] = {}

    pipeline = [{"$match": {"node_id": {"$in": node_ids}}}, _GROUP_STAGE]
    async for row in db.logs.aggregate(pipeline):
        stats[str(row["_id"])] = _from_log_row(row)

    cursor = db.review_state.find(
        {"node_id": {"$in": node_ids}},
        {"node_id": 1, "next_due": 1, "last_confidence": 1},
    )
    async for row in cursor:
        entry = stats.setdefault(str(row["node_id"]), {})
        entry["next_due"] = row.get("next_due")
        entry["confidence"] = row.get("last_confidence")

    return stats
