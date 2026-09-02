"""Current-affairs capture and tagging.

Two rules carry the collection. First, capture must never be blocked: an item
needs a headline and nothing else, and an untagged item is a first-class
citizen rather than a broken one — it sits in the inbox until she connects it
to the syllabus.

Second, tagging is a study action. Connecting an item to a topic writes a `ca`
log against that node, which is what puts current affairs onto the node
timeline where revision will find it. Untagging takes the log away again, so
the timeline never claims a connection the item no longer makes.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import today_ist
from app.models.ca import CaCreate, CaUpdate, month_of

#: An item attaches to a topic or a leaf, never to a whole section — the rule
#: logs, mistakes and answers all use. "GS2/Polity" is not a revision unit.
MIN_TAGGABLE_LEVEL = 2


class CaError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def _oid(value: str, what: str = "item") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise CaError(f"Invalid {what} id.", status=400)
    return ObjectId(value)


async def _load_node(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    node = await db.syllabus_nodes.find_one({"_id": _oid(node_id, "node")})
    if node is None:
        raise CaError("That topic no longer exists.", status=404)
    if node.get("is_archived"):
        raise CaError("That topic is archived.", status=409)
    if node["level"] < MIN_TAGGABLE_LEVEL:
        raise CaError("Pick a topic inside this section, not the section itself.")
    return node


async def create_item(db: AsyncIOMotorDatabase, payload: CaCreate) -> dict[str, Any]:
    """Capture an item. The topic is optional; most arrive untagged."""
    doc = payload.model_dump(mode="json")
    node = await _load_node(db, payload.node_id) if payload.node_id else None

    doc["month"] = month_of(doc["date"])
    doc["node_id"] = node["_id"] if node else None
    doc["paper"] = node["paper"] if node else None
    doc["tagged"] = node is not None
    doc["created_at"] = datetime.now(UTC)

    result = await db.ca_items.insert_one(doc)
    doc["_id"] = result.inserted_id
    if node:
        await _write_log(db, doc)
    await _attach_nodes(db, [doc])
    return doc


async def get_item(db: AsyncIOMotorDatabase, item_id: str) -> dict[str, Any]:
    doc = await db.ca_items.find_one({"_id": _oid(item_id)})
    if doc is None:
        raise CaError("That item is not there.", status=404)
    await _attach_nodes(db, [doc])
    return doc


async def update_item(
    db: AsyncIOMotorDatabase, item_id: str, patch: CaUpdate
) -> dict[str, Any]:
    """Apply a partial update.

    Tagging from the inbox is this endpoint, so it carries the derived fields:
    `tagged` and `paper` follow the node, `month` follows the date, and the log
    is rewritten to match. None of the three is ever taken from the client.
    """
    oid = _oid(item_id)
    current = await db.ca_items.find_one({"_id": oid})
    if current is None:
        raise CaError("That item is not there.", status=404)

    changes = patch.model_dump(mode="json", exclude_unset=True)
    if not changes:
        await _attach_nodes(db, [current])
        return current

    if "date" in changes:
        changes["month"] = month_of(changes["date"])

    # An explicit null is the untag: it is only distinguishable from "the
    # client did not mention the node" because exclude_unset kept it.
    if "node_id" in changes:
        if changes["node_id"] is None:
            changes.update({"node_id": None, "paper": None, "tagged": False})
        else:
            node = await _load_node(db, changes["node_id"])
            changes.update(
                {"node_id": node["_id"], "paper": node["paper"], "tagged": True}
            )

    await db.ca_items.update_one({"_id": oid}, {"$set": changes})
    if {"node_id", "date"} & set(changes):
        await _sync_log(db, {**current, **changes})
    return await get_item(db, item_id)


async def delete_item(db: AsyncIOMotorDatabase, item_id: str) -> None:
    """Delete an item and the log its tagging left behind."""
    oid = _oid(item_id)
    result = await db.ca_items.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise CaError("That item is already gone.", status=404)
    await _clear_log(db, oid)


async def _write_log(db: AsyncIOMotorDatabase, item: dict[str, Any]) -> None:
    """The `ca` log for a tagged item.

    Written here rather than through `services.logs` for the reason an answer's
    is: there is no scheduling side-effect to run, and the node has already
    been resolved. Minutes are null — reading a newspaper is not measured
    against a topic, and a made-up number would distort the effort chart.
    """
    await db.logs.insert_one(
        {
            "node_id": item["node_id"],
            "type": "ca",
            "date": item["date"],
            "minutes": None,
            "payload": {"ca_id": str(item["_id"])},
            "created_at": datetime.now(UTC),
            "review_effect": None,
            "prev_review_state": None,
        }
    )


async def _sync_log(db: AsyncIOMotorDatabase, merged: dict[str, Any]) -> None:
    """Make the log match the item after a retag or a date correction.

    Replaced rather than updated: a retag moves the log to a different node,
    and an untag removes it entirely, so there is no single `$set` that covers
    every case.
    """
    await _clear_log(db, merged["_id"])
    if merged.get("node_id") is not None:
        await _write_log(db, merged)


async def _clear_log(db: AsyncIOMotorDatabase, oid: ObjectId) -> None:
    await db.logs.delete_many({"type": "ca", "payload.ca_id": str(oid)})


async def list_items(
    db: AsyncIOMotorDatabase,
    *,
    month: str | None = None,
    node_id: str | None = None,
    paper: str | None = None,
    tagged: bool | None = None,
    starred: bool | None = None,
    limit: int = 30,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """A page of items, newest first.

    Sorted on `_id` for the reason the other lists are: five items captured on
    one morning share a date, and a page boundary between them would drop a row
    if the date were the sort key.
    """
    query: dict[str, Any] = {}
    if month:
        query["month"] = month
    if node_id:
        query["node_id"] = _oid(node_id, "node")
    if paper:
        query["paper"] = paper
    if tagged is not None:
        query["tagged"] = tagged
    if starred is not None:
        query["starred"] = starred
    if cursor:
        query["_id"] = {"$lt": _oid(cursor, "cursor")}

    docs = await db.ca_items.find(query).sort([("_id", -1)]).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = str(docs[-1]["_id"]) if has_more and docs else None

    await _attach_nodes(db, docs)
    return docs, next_cursor


async def inbox(
    db: AsyncIOMotorDatabase, *, limit: int = 50
) -> tuple[list[dict[str, Any]], int]:
    """Untagged items, oldest first, with the full count.

    Oldest first because the inbox is a queue to empty, not a feed to read: the
    item captured last Tuesday is the one whose context is fading.
    """
    docs = await (
        db.ca_items.find({"tagged": False})
        .sort([("_id", 1)])
        .to_list(length=limit)
    )
    total = await db.ca_items.count_documents({"tagged": False})
    await _attach_nodes(db, docs)
    return docs, total


async def months(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """Every month that has items, newest first — the month filter's options.

    Built from the data rather than from a calendar range, so the filter never
    offers an empty month.
    """
    pipeline = [
        {
            "$group": {
                "_id": "$month",
                "count": {"$sum": 1},
                "untagged": {
                    "$sum": {"$cond": [{"$eq": ["$tagged", True]}, 0, 1]}
                },
            }
        },
        {"$sort": {"_id": -1}},
    ]
    rows = await db.ca_items.aggregate(pipeline).to_list(length=None)
    return [
        {"month": row["_id"], "count": row["count"], "untagged": row["untagged"]}
        for row in rows
    ]


async def untagged_count(db: AsyncIOMotorDatabase) -> int:
    """The number on the Today screen's current-affairs row."""
    return await db.ca_items.count_documents({"tagged": False})


async def captured_today(db: AsyncIOMotorDatabase, day: str | None = None) -> int:
    """How many items she has captured on a study day."""
    return await db.ca_items.count_documents({"date": day or today_ist()})


async def _attach_nodes(db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]) -> None:
    """One extra query for a whole page. Titles are joined rather than stored,
    so a renamed topic is renamed everywhere it shows."""
    node_ids = list({doc["node_id"] for doc in docs if doc.get("node_id")})
    if not node_ids:
        return
    nodes = await db.syllabus_nodes.find(
        {"_id": {"$in": node_ids}}, {"title": 1, "path": 1}
    ).to_list(length=None)
    by_id = {node["_id"]: node for node in nodes}
    for doc in docs:
        node = by_id.get(doc.get("node_id"))
        if node:
            doc["node_title"] = node["title"]
            doc["node_path"] = node["path"]
