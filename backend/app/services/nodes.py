"""Writes against the syllabus tree.

`path` is denormalised, so every write that changes a title or a parent has to
repair the paths of the whole subtree underneath. That is the entire reason this
module exists rather than the routers talking to Mongo directly.
"""

import re
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne

MAX_LEVEL = 3


class NodeError(Exception):
    """A rejected write. The router turns this into a 4xx with this message."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def clean_title(title: str) -> str:
    """Titles are path segments, so a slash in one would corrupt the path.

    Whitespace is collapsed as well, otherwise removing a slash leaves a gap
    and two titles that look identical would not compare as equal.
    """
    cleaned = re.sub(r"\s+", " ", title.replace("/", " ")).strip()
    if not cleaned:
        raise NodeError("A title cannot be empty.")
    return cleaned


async def _get(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    if not ObjectId.is_valid(node_id):
        raise NodeError("Invalid node id.", status=400)
    doc = await db.syllabus_nodes.find_one({"_id": ObjectId(node_id)})
    if doc is None:
        raise NodeError("Node not found.", status=404)
    return doc


async def _descendants(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> list[dict]:
    """Everything under a node, found by path prefix.

    A prefix query beats walking parent_id level by level, and the trailing
    slash stops "GS2/Polity" from matching "GS2/Polity and governance".
    """
    prefix = f"{doc['path']}/"
    return await db.syllabus_nodes.find(
        {"paper": doc["paper"], "path": {"$regex": f"^{_escape(prefix)}"}}
    ).to_list(length=None)


def _escape(value: str) -> str:
    return re.escape(value)


async def create_node(
    db: AsyncIOMotorDatabase,
    *,
    paper: str,
    title: str,
    parent_id: str | None,
    pyq_weight: str = "medium",
    needs_diagram: bool = False,
    notes: str = "",
) -> dict[str, Any]:
    """Create a custom node. Custom nodes carry no seed_key, which is what keeps
    the seeder from ever matching — and therefore touching — them."""
    title = clean_title(title)

    if parent_id is None:
        level, parent_oid, path = 1, None, f"{paper}/{title}"
    else:
        parent = await _get(db, parent_id)
        if parent["paper"] != paper:
            raise NodeError("Parent belongs to a different paper.")
        if parent["level"] >= MAX_LEVEL:
            raise NodeError(f"The tree is only {MAX_LEVEL} levels deep.")
        level = parent["level"] + 1
        parent_oid = parent["_id"]
        path = f"{parent['path']}/{title}"

    if await db.syllabus_nodes.find_one({"paper": paper, "path": path}):
        raise NodeError("A node with that title already exists here.", status=409)

    last = await db.syllabus_nodes.find_one(
        {"paper": paper, "parent_id": parent_oid}, sort=[("order", -1)]
    )
    now = datetime.now(UTC)

    doc = {
        "paper": paper,
        "parent_id": parent_oid,
        "title": title,
        "level": level,
        "order": (last["order"] + 1) if last else 0,
        "path": path,
        "seed_key": None,
        "pyq_weight": pyq_weight,
        "needs_diagram": needs_diagram,
        "is_custom": True,
        "is_archived": False,
        "notes": notes,
        "gs_linkage": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await db.syllabus_nodes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def update_node(
    db: AsyncIOMotorDatabase, node_id: str, patch: dict[str, Any]
) -> dict[str, Any]:
    """Apply a partial update. A title change repaths every descendant."""
    doc = await _get(db, node_id)
    changes: dict[str, Any] = {
        key: value for key, value in patch.items() if value is not None
    }
    if not changes:
        return doc

    repath: list[UpdateOne] = []
    if "title" in changes:
        new_title = clean_title(changes["title"])
        changes["title"] = new_title
        if new_title != doc["title"]:
            old_path = doc["path"]
            parent_path = old_path.rsplit("/", 1)[0]
            new_path = f"{parent_path}/{new_title}"
            if await db.syllabus_nodes.find_one(
                {"paper": doc["paper"], "path": new_path, "_id": {"$ne": doc["_id"]}}
            ):
                raise NodeError("A sibling already has that title.", status=409)
            changes["path"] = new_path
            repath = _repath_ops(await _descendants(db, doc), old_path, new_path)

    changes["updated_at"] = datetime.now(UTC)
    await db.syllabus_nodes.update_one({"_id": doc["_id"]}, {"$set": changes})
    if repath:
        await db.syllabus_nodes.bulk_write(repath)

    return await _get(db, node_id)


def _repath_ops(descendants: list[dict], old_path: str, new_path: str) -> list[UpdateOne]:
    now = datetime.now(UTC)
    return [
        UpdateOne(
            {"_id": child["_id"]},
            {
                "$set": {
                    "path": new_path + child["path"][len(old_path) :],
                    "updated_at": now,
                }
            },
        )
        for child in descendants
    ]


async def move_node(
    db: AsyncIOMotorDatabase, node_id: str, new_parent_id: str | None, order: int | None
) -> dict[str, Any]:
    """Reparent a node, carrying its subtree with it."""
    doc = await _get(db, node_id)
    descendants = await _descendants(db, doc)

    if new_parent_id is None:
        new_level, parent_oid, new_path = 1, None, f"{doc['paper']}/{doc['title']}"
    else:
        parent = await _get(db, new_parent_id)
        if parent["_id"] == doc["_id"]:
            raise NodeError("A node cannot be its own parent.")
        if any(child["_id"] == parent["_id"] for child in descendants):
            raise NodeError("A node cannot move inside its own subtree.")
        if parent["paper"] != doc["paper"]:
            raise NodeError("Nodes cannot move between papers.")
        new_level = parent["level"] + 1
        parent_oid = parent["_id"]
        new_path = f"{parent['path']}/{doc['title']}"

    depth = max(
        (child["level"] - doc["level"] for child in descendants), default=0
    )
    if new_level + depth > MAX_LEVEL:
        raise NodeError(f"That move would push the tree past {MAX_LEVEL} levels.")

    if new_path != doc["path"] and await db.syllabus_nodes.find_one(
        {"paper": doc["paper"], "path": new_path}
    ):
        raise NodeError("The new parent already has a child with that title.", status=409)

    now = datetime.now(UTC)
    await db.syllabus_nodes.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "parent_id": parent_oid,
                "level": new_level,
                "path": new_path,
                "order": order if order is not None else doc["order"],
                "updated_at": now,
            }
        },
    )

    shift = new_level - doc["level"]
    operations = [
        UpdateOne(
            {"_id": child["_id"]},
            {
                "$set": {
                    "path": new_path + child["path"][len(doc["path"]) :],
                    "level": child["level"] + shift,
                    "updated_at": now,
                }
            },
        )
        for child in descendants
    ]
    if operations:
        await db.syllabus_nodes.bulk_write(operations)

    return await _get(db, node_id)


async def archive_node(db: AsyncIOMotorDatabase, node_id: str) -> dict[str, Any]:
    """Soft delete. Refused while live children still hang off it, so nothing
    disappears from the tree without being asked for explicitly."""
    doc = await _get(db, node_id)
    live_children = await db.syllabus_nodes.count_documents(
        {"parent_id": doc["_id"], "is_archived": False}
    )
    if live_children:
        noun = "child" if live_children == 1 else "children"
        raise NodeError(
            f"Archive or move its {live_children} {noun} first.", status=409
        )

    await db.syllabus_nodes.update_one(
        {"_id": doc["_id"]},
        {"$set": {"is_archived": True, "updated_at": datetime.now(UTC)}},
    )
    return await _get(db, node_id)
