"""The syllabus tree: reads, writes, and the rollups that colour the rows.

The tree endpoint is the app's hot path — it is what the Syllabus tab loads
every time — so it is served from a short-lived cache that every write here
clears.
"""

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_api_key
from app.db import get_db
from app.models.common import SUBJECT_META, Subject
from app.models.syllabus import (
    NodeMove,
    SubjectSummary,
    SyllabusNodeCreate,
    SyllabusNodeUpdate,
    TreeNode,
)
from app.services import cache, nodes as node_service
from app.services.rollups import node_stats, subject_stats
from app.services.tree import build_tree

router = APIRouter(prefix="/syllabus", tags=["syllabus"], dependencies=[Depends(require_api_key)])


@router.get("/subjects", response_model=list[SubjectSummary])
async def list_subjects() -> list[SubjectSummary]:
    """Every subject with its live topic count, for the chip rail.

    Subjects with nothing seeded are still returned, at zero: a missing chip
    reads as a broken app, whereas a zero reads as a seed that has not been run.
    """
    db = get_db()
    cursor = db.syllabus_nodes.aggregate(
        [
            {"$match": {"is_archived": False}},
            {"$group": {"_id": "$subject", "n": {"$sum": 1}}},
        ]
    )
    counts = {row["_id"]: row["n"] async for row in cursor}

    return [
        SubjectSummary(
            subject=subject,
            label=meta.label,
            stage=meta.stage,
            source_kind=meta.source_kind,
            source_name=meta.source_name,
            topics=counts.get(subject.value, 0),
        )
        for subject, meta in SUBJECT_META.items()
    ]


@router.get("/tree", response_model=list[TreeNode])
async def tree(
    subject: Subject = Query(..., description="Subject to return the tree for"),
    include_archived: bool = False,
) -> list[TreeNode]:
    """Full nested tree for one subject, with each row's activity rolled in.

    Three queries regardless of how many nodes the subject has: the nodes, their
    logs, their review states.
    """
    key = f"tree:{subject.value}:{include_archived}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    db = get_db()
    match: dict = {"subject": subject.value}
    if not include_archived:
        match["is_archived"] = False

    docs = await db.syllabus_nodes.find(match).sort("order", 1).to_list(length=None)
    result = build_tree(docs, await subject_stats(db, subject.value))
    cache.put(key, result)
    return result


@router.get("/search", response_model=list[TreeNode])
async def search(q: str = Query(min_length=2), limit: int = 25) -> list[TreeNode]:
    db = get_db()
    docs = await (
        db.syllabus_nodes.find(
            {"$text": {"$search": q}, "is_archived": False},
            {"score": {"$meta": "textScore"}},
        )
        .sort([("score", {"$meta": "textScore"})])
        .to_list(length=limit)
    )
    return [TreeNode(**doc) for doc in docs]


@router.get("/nodes/{node_id}", response_model=TreeNode)
async def node_detail(node_id: str) -> TreeNode:
    """One node with its own activity attached, for the detail screen."""
    if not ObjectId.is_valid(node_id):
        raise HTTPException(status_code=400, detail="Invalid node id.")
    db = get_db()
    doc = await db.syllabus_nodes.find_one({"_id": ObjectId(node_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Node not found.")
    return TreeNode(**doc, **await node_stats(db, doc["_id"]))


def _handle(error: node_service.NodeError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("/nodes", response_model=TreeNode, status_code=status.HTTP_201_CREATED)
async def create_node(payload: SyllabusNodeCreate) -> TreeNode:
    """Create a custom node. Custom nodes are never touched by the seeder."""
    try:
        doc = await node_service.create_node(
            get_db(),
            subject=payload.subject.value,
            title=payload.title,
            parent_id=payload.parent_id,
            pyq_weight=payload.pyq_weight.value,
            needs_diagram=payload.needs_diagram,
            notes=payload.notes,
        )
    except node_service.NodeError as error:
        raise _handle(error) from error
    cache.invalidate()
    return TreeNode(**doc)


@router.patch("/nodes/{node_id}", response_model=TreeNode)
async def update_node(node_id: str, payload: SyllabusNodeUpdate) -> TreeNode:
    """Rename, reweight, reorder or archive. A rename repaths all descendants."""
    patch = payload.model_dump(exclude_unset=True)
    try:
        doc = await node_service.update_node(get_db(), node_id, patch)
    except node_service.NodeError as error:
        raise _handle(error) from error
    cache.invalidate()
    return TreeNode(**doc)


@router.post("/nodes/{node_id}/move", response_model=TreeNode)
async def move_node(node_id: str, payload: NodeMove) -> TreeNode:
    try:
        doc = await node_service.move_node(
            get_db(), node_id, payload.parent_id, payload.order
        )
    except node_service.NodeError as error:
        raise _handle(error) from error
    cache.invalidate()
    return TreeNode(**doc)


@router.delete("/nodes/{node_id}", response_model=TreeNode)
async def archive_node(node_id: str) -> TreeNode:
    """Soft delete. Refused while the node still has live children."""
    try:
        doc = await node_service.archive_node(get_db(), node_id)
    except node_service.NodeError as error:
        raise _handle(error) from error
    cache.invalidate()
    return TreeNode(**doc)
