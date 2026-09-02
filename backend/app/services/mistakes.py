"""The mistake notebook.

Two things make this collection worth having over just re-reading the tests
list: the five-way tag, and that every mistake carries the syllabus node it came
from. So each write resolves the node (rejecting a whole section, exactly as
logging does) and denormalises its paper, which lets every read filter by tag
and paper without touching `syllabus_nodes`.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.mistakes import (
    TAG_LABELS,
    MistakeBulk,
    MistakeCreate,
    MistakeItem,
    MistakeTag,
    MistakeUpdate,
)

#: A mistake attaches to a topic or a leaf, never to a whole section — the same
#: rule logging uses, and for the same reason: "GS2/Polity" is not a diagnosis.
MIN_TAGGABLE_LEVEL = 2


class MistakeError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def _oid(value: str, what: str = "mistake") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise MistakeError(f"Invalid {what} id.", status=400)
    return ObjectId(value)


async def _resolve_nodes(
    db: AsyncIOMotorDatabase, node_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Load the nodes a batch of mistakes points at, in one query.

    Bulk entry is 27 rows on a bad day; a lookup per row would make the one
    screen that has to feel instant the slowest in the app.
    """
    oids = [_oid(node_id, "node") for node_id in set(node_ids)]
    nodes = await db.syllabus_nodes.find({"_id": {"$in": oids}}).to_list(length=None)
    by_id = {str(node["_id"]): node for node in nodes}

    for node_id in set(node_ids):
        node = by_id.get(node_id)
        if node is None:
            raise MistakeError("That topic no longer exists.", status=404)
        if node["level"] < MIN_TAGGABLE_LEVEL:
            raise MistakeError(
                "Pick a topic inside this section, not the section itself."
            )
    return by_id


def _document(
    item: MistakeItem,
    node: dict[str, Any],
    *,
    date: str,
    source_type: str,
    source_id: ObjectId | None,
) -> dict[str, Any]:
    return {
        "source_type": source_type,
        "source_id": source_id,
        "node_id": node["_id"],
        "paper": node["paper"],
        "date": date,
        "question": item.question.strip(),
        "tag": item.tag.value,
        "note": item.note.strip(),
        "resolved": False,
        "resolved_at": None,
        "created_at": datetime.now(UTC),
    }


async def create_mistake(
    db: AsyncIOMotorDatabase, payload: MistakeCreate
) -> dict[str, Any]:
    """One mistake on its own — noticed while reading, or added after the fact."""
    nodes = await _resolve_nodes(db, [payload.node_id])
    doc = _document(
        payload,
        nodes[payload.node_id],
        date=payload.date,
        source_type=payload.source_type.value,
        source_id=_oid(payload.source_id, "source") if payload.source_id else None,
    )
    result = await db.mistakes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def add_test_mistakes(
    db: AsyncIOMotorDatabase, test_id: str, payload: MistakeBulk
) -> list[dict[str, Any]]:
    """The rapid-entry list from a test detail screen, saved in one write.

    Mistakes are dated to the test rather than to the evening she got round to
    typing them in, so the notebook's date filters line up with the attempts.
    """
    oid = _oid(test_id, "test")
    test = await db.tests.find_one({"_id": oid})
    if test is None:
        raise MistakeError("That test is not there.", status=404)

    nodes = await _resolve_nodes(db, [item.node_id for item in payload.items])
    docs = [
        _document(
            item,
            nodes[item.node_id],
            date=test["date"],
            source_type="mcq",
            source_id=oid,
        )
        for item in payload.items
    ]
    result = await db.mistakes.insert_many(docs)
    for doc, inserted in zip(docs, result.inserted_ids, strict=True):
        doc["_id"] = inserted
    return docs


async def get_mistake(db: AsyncIOMotorDatabase, mistake_id: str) -> dict[str, Any]:
    doc = await db.mistakes.find_one({"_id": _oid(mistake_id)})
    if doc is None:
        raise MistakeError("That mistake is not there.", status=404)
    await _attach_sources(db, [doc])
    return doc


async def update_mistake(
    db: AsyncIOMotorDatabase, mistake_id: str, patch: MistakeUpdate
) -> dict[str, Any]:
    """Retag, re-file under another topic, or mark it settled."""
    oid = _oid(mistake_id)
    current = await db.mistakes.find_one({"_id": oid})
    if current is None:
        raise MistakeError("That mistake is not there.", status=404)

    changes = patch.model_dump(mode="json", exclude_unset=True)
    if not changes:
        await _attach_sources(db, [current])
        return current

    if changes.get("node_id"):
        node = (await _resolve_nodes(db, [changes["node_id"]]))[changes["node_id"]]
        changes["node_id"] = node["_id"]
        changes["paper"] = node["paper"]

    if "resolved" in changes:
        changes["resolved_at"] = datetime.now(UTC) if changes["resolved"] else None

    await db.mistakes.update_one({"_id": oid}, {"$set": changes})
    return await get_mistake(db, mistake_id)


async def delete_mistake(db: AsyncIOMotorDatabase, mistake_id: str) -> None:
    result = await db.mistakes.delete_one({"_id": _oid(mistake_id)})
    if result.deleted_count == 0:
        raise MistakeError("That mistake is already gone.", status=404)


async def list_mistakes(
    db: AsyncIOMotorDatabase,
    *,
    tag: str | None = None,
    paper: str | None = None,
    node_id: str | None = None,
    source_id: str | None = None,
    resolved: bool | None = None,
    query_text: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """A page of mistakes, newest first, with the node and test joined on."""
    query = _filter(
        tag=tag,
        paper=paper,
        node_id=node_id,
        source_id=source_id,
        resolved=resolved,
        query_text=query_text,
        date_from=date_from,
        date_to=date_to,
    )
    if cursor:
        query["_id"] = {"$lt": _oid(cursor, "cursor")}

    docs = await db.mistakes.find(query).sort([("_id", -1)]).to_list(length=limit + 1)
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = str(docs[-1]["_id"]) if has_more and docs else None

    await _attach_sources(db, docs)
    return docs, next_cursor


def _filter(
    *,
    tag: str | None = None,
    paper: str | None = None,
    node_id: str | None = None,
    source_id: str | None = None,
    resolved: bool | None = None,
    query_text: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """The shared filter, so the list and the summary above it can never
    disagree about what the current view contains."""
    query: dict[str, Any] = {}
    if tag:
        query["tag"] = MistakeTag(tag).value
    if paper:
        query["paper"] = paper
    if node_id:
        query["node_id"] = _oid(node_id, "node")
    if source_id:
        query["source_id"] = _oid(source_id, "source")
    if resolved is not None:
        query["resolved"] = resolved
    if query_text:
        # The text index covers question and note, which is where she writes
        # what actually went wrong.
        query["$text"] = {"$search": query_text}
    if date_from or date_to:
        span: dict[str, str] = {}
        if date_from:
            span["$gte"] = date_from
        if date_to:
            span["$lte"] = date_to
        query["date"] = span
    return query


async def _attach_sources(db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]) -> None:
    """Two extra queries for a whole page: the nodes, and the tests they came
    from. Titles are joined rather than stored, so a renamed topic is renamed
    everywhere it appears."""
    if not docs:
        return

    node_ids = list({doc["node_id"] for doc in docs})
    nodes = await db.syllabus_nodes.find(
        {"_id": {"$in": node_ids}}, {"title": 1, "path": 1}
    ).to_list(length=None)
    by_node = {node["_id"]: node for node in nodes}

    test_ids = list({doc["source_id"] for doc in docs if doc.get("source_id")})
    tests = (
        await db.tests.find({"_id": {"$in": test_ids}}, {"title": 1}).to_list(
            length=None
        )
        if test_ids
        else []
    )
    by_test = {test["_id"]: test for test in tests}

    for doc in docs:
        node = by_node.get(doc["node_id"])
        if node:
            doc["node_title"] = node["title"]
            doc["node_path"] = node["path"]
        test = by_test.get(doc.get("source_id"))
        if test:
            doc["source_title"] = test["title"]


async def summary(
    db: AsyncIOMotorDatabase,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    paper: str | None = None,
) -> dict[str, Any]:
    """Counts per tag and per paper — the stacked bar and its legend.

    Every tag comes back, zeroes included: the bar keeps five segments in a
    fixed order, so a glance this week compares with the same glance last week.
    """
    match = _filter(paper=paper, date_from=date_from, date_to=date_to)
    pipeline: list[dict[str, Any]] = [
        {"$match": match},
        {
            "$facet": {
                "tags": [{"$group": {"_id": "$tag", "n": {"$sum": 1}}}],
                "papers": [{"$group": {"_id": "$paper", "n": {"$sum": 1}}}],
                "unresolved": [{"$match": {"resolved": False}}, {"$count": "n"}],
                "total": [{"$count": "n"}],
            }
        },
    ]
    result = await db.mistakes.aggregate(pipeline).to_list(length=1)
    facet = result[0] if result else {}

    tag_counts = {row["_id"]: row["n"] for row in facet.get("tags", [])}
    papers = sorted(
        ({"paper": row["_id"], "count": row["n"]} for row in facet.get("papers", [])),
        key=lambda row: (-row["count"], row["paper"]),
    )

    return {
        "total": _first(facet.get("total")),
        "unresolved": _first(facet.get("unresolved")),
        "by_tag": [
            {
                "tag": tag.value,
                "label": TAG_LABELS[tag],
                "count": tag_counts.get(tag.value, 0),
            }
            for tag in MistakeTag
        ],
        "by_paper": papers,
    }


def _first(rows: list[dict[str, Any]] | None) -> int:
    return rows[0]["n"] if rows else 0
