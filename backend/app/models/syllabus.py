"""Syllabus node schemas.

The tree is stored flat with `parent_id`. `path` is the denormalised
slash-joined title chain used for search and breadcrumbs; `seed_key` is the
stable slug chain the seeder upserts on, so renaming a node never causes the
seed to re-insert it as a duplicate.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.common import Paper, PyObjectId, PyqWeight


class SyllabusNodeBase(BaseModel):
    paper: Paper
    title: str = Field(min_length=1, max_length=300)
    level: int = Field(ge=1, le=3)
    order: int = 0
    pyq_weight: PyqWeight = PyqWeight.MEDIUM
    needs_diagram: bool = False
    notes: str = ""


class SyllabusNodeCreate(SyllabusNodeBase):
    parent_id: PyObjectId | None = None


class SyllabusNodeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    pyq_weight: PyqWeight | None = None
    needs_diagram: bool | None = None
    notes: str | None = None
    order: int | None = None
    is_archived: bool | None = None


class SyllabusNode(SyllabusNodeBase):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    parent_id: PyObjectId | None = None
    path: str = ""
    seed_key: str | None = None
    is_custom: bool = False
    is_archived: bool = False
    gs_linkage: list[PyObjectId] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TreeNode(SyllabusNode):
    """A node plus its children, as returned by /syllabus/tree.

    Rollup fields are placeholders until logging lands in phase 2.
    """

    children: list["TreeNode"] = Field(default_factory=list)
    read_count: int = 0
    revise_count: int = 0
    mcq_accuracy: float | None = None
    next_due: str | None = None
    last_touched: str | None = None


TreeNode.model_rebuild()


class PaperSummary(BaseModel):
    paper: Paper
    label: str
    sections: int
    topics: int
    leaves: int
