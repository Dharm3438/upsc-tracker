"""Syllabus reads.

Phase 1 ships the read side: the nested tree and the per-paper counts the
paper chips need. Create/rename/move/archive and the log-derived rollups land
with phases 1b and 2.
"""

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_api_key
from app.db import get_db
from app.models.common import PAPER_LABELS, Paper
from app.models.syllabus import (
    NodeMove,
    PaperSummary,
    SyllabusNodeCreate,
    SyllabusNodeUpdate,
    TreeNode,
)
from app.services import nodes as node_service
from app.services.tree import build_tree

router = APIRouter(prefix="/syllabus", tags=["syllabus"], dependencies=[Depends(require_api_key)])


@router.get("/papers", response_model=list[PaperSummary])
async def list_papers() -> list[PaperSummary]:
    """Counts per paper, for the chip row and to prove the seed landed."""
    db = get_db()
    cursor = db.syllabus_nodes.aggregate(
        [
            {"$match": {"is_archived": False}},
            {"$group": {"_id": {"paper": "$paper", "level": "$level"}, "n": {"$sum": 1}}},
        ]
    )
    counts: dict[str, dict[int, int]] = {}
    async for row in cursor:
        counts.setdefault(row["_id"]["paper"], {})[row["_id"]["level"]] = row["n"]

    return [
        PaperSummary(
            paper=paper,
            label=PAPER_LABELS[paper],
            sections=counts.get(paper.value, {}).get(1, 0),
            topics=counts.get(paper.value, {}).get(2, 0),
            leaves=counts.get(paper.value, {}).get(3, 0),
        )
        for paper in Paper
    ]


@router.get("/tree", response_model=list[TreeNode])
async def tree(
    paper: Paper = Query(..., description="Paper to return the tree for"),
    include_archived: bool = False,
) -> list[TreeNode]:
    """Full nested tree for one paper, built from a single flat query."""
    db = get_db()
    match: dict = {"paper": paper.value}
    if not include_archived:
        match["is_archived"] = False

    docs = await db.syllabus_nodes.find(match).sort("order", 1).to_list(length=None)
    return build_tree(docs)


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
    if not ObjectId.is_valid(node_id):
        raise HTTPException(status_code=400, detail="Invalid node id.")
    doc = await get_db().syllabus_nodes.find_one({"_id": ObjectId(node_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail="Node not found.")
    return TreeNode(**doc)


def _handle(error: node_service.NodeError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("/nodes", response_model=TreeNode, status_code=status.HTTP_201_CREATED)
async def create_node(payload: SyllabusNodeCreate) -> TreeNode:
    """Create a custom node. Custom nodes are never touched by the seeder."""
    try:
        doc = await node_service.create_node(
            get_db(),
            paper=payload.paper.value,
            title=payload.title,
            parent_id=payload.parent_id,
            pyq_weight=payload.pyq_weight.value,
            needs_diagram=payload.needs_diagram,
            notes=payload.notes,
        )
    except node_service.NodeError as error:
        raise _handle(error) from error
    return TreeNode(**doc)


@router.patch("/nodes/{node_id}", response_model=TreeNode)
async def update_node(node_id: str, payload: SyllabusNodeUpdate) -> TreeNode:
    """Rename, reweight, reorder or archive. A rename repaths all descendants."""
    patch = payload.model_dump(exclude_unset=True)
    try:
        doc = await node_service.update_node(get_db(), node_id, patch)
    except node_service.NodeError as error:
        raise _handle(error) from error
    return TreeNode(**doc)


@router.post("/nodes/{node_id}/move", response_model=TreeNode)
async def move_node(node_id: str, payload: NodeMove) -> TreeNode:
    try:
        doc = await node_service.move_node(
            get_db(), node_id, payload.parent_id, payload.order
        )
    except node_service.NodeError as error:
        raise _handle(error) from error
    return TreeNode(**doc)


@router.delete("/nodes/{node_id}", response_model=TreeNode)
async def archive_node(node_id: str) -> TreeNode:
    """Soft delete. Refused while the node still has live children."""
    try:
        doc = await node_service.archive_node(get_db(), node_id)
    except node_service.NodeError as error:
        raise _handle(error) from error
    return TreeNode(**doc)
