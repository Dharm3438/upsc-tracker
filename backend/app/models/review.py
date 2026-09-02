"""Revision queue schemas.

These are read models, not stored documents. A due row is a join of
`review_state` and the node it belongs to, shaped so the Today screen can draw
the row and open the grading sheet without a second request — the sheet needs
the topic's own notes, and fetching those per row would be six requests for a
normal morning.
"""

from pydantic import BaseModel, Field

from app.models.common import Paper, PyObjectId, PyqWeight


class DueNode(BaseModel):
    """One row of the due list."""

    node_id: PyObjectId
    title: str
    path: str
    paper: Paper
    level: int
    pyq_weight: PyqWeight = PyqWeight.MEDIUM
    needs_diagram: bool = False
    #: Shown in the grading sheet, where they are the prompt for the recall.
    notes: str = ""

    next_due: str
    #: 0 when due exactly today. The warm overdue tone starts past 14.
    days_overdue: int = 0
    last_reviewed: str | None = None
    #: A first read records one too, so this is null only on a state that
    #: somehow never carried a confidence.
    last_confidence: int | None = None
    repetitions: int = 0
    lapses: int = 0


class DueList(BaseModel):
    #: The study day the queue was computed for.
    date: str
    #: Everything due, even when `items` was capped by `limit`.
    total: int
    items: list[DueNode]


class UpcomingDay(BaseModel):
    date: str
    count: int


class Upcoming(BaseModel):
    """The small forecast bar. Zero-filled, so the bar has no gaps."""

    date: str
    #: Due before today and still ungraded. Sits outside the per-day counts so
    #: a backlog cannot masquerade as today's workload.
    overdue: int = 0
    days: list[UpcomingDay] = Field(default_factory=list)
