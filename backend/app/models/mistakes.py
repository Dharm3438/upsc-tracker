"""Mistake notebook schemas.

The five-way tag split is the point of the collection: "40 wrong" tells her
nothing, "24 of them careless" tells her what to change this week. Everything
else here is in service of entering a tag quickly and finding it again later.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.dates import today_ist
from app.models.common import Subject, PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class MistakeTag(StrEnum):
    UNKNOWN = "unknown"
    SILLY = "silly"
    ELIMINATION = "elimination"
    MISREAD = "misread"
    GUESS = "guess"


#: Sentence-case labels, shared by the summary so the API and the UI cannot
#: drift apart on what "elimination" means.
TAG_LABELS: dict[MistakeTag, str] = {
    MistakeTag.UNKNOWN: "Didn't know it",
    MistakeTag.SILLY: "Careless",
    MistakeTag.ELIMINATION: "Bad elimination",
    MistakeTag.MISREAD: "Misread it",
    MistakeTag.GUESS: "Wrong guess",
}


class MistakeSourceType(StrEnum):
    MCQ = "mcq"
    ANSWER = "answer"


class MistakeItem(BaseModel):
    """One row of the rapid-entry list. Node and tag required, the rest not —
    a mistake with no question text is still a diagnosis."""

    node_id: PyObjectId
    tag: MistakeTag
    question: str = Field(default="", max_length=2000)
    note: str = Field(default="", max_length=2000)


class MistakeCreate(MistakeItem):
    date: str = Field(default_factory=today_ist, pattern=DAY_PATTERN)
    source_type: MistakeSourceType = MistakeSourceType.MCQ
    #: The test or answer this came out of. Null for one she noticed while
    #: reading and wanted to keep.
    source_id: PyObjectId | None = None


class MistakeBulk(BaseModel):
    """POST /tests/{id}/mistakes — the whole wrong-answer list in one write."""

    items: list[MistakeItem] = Field(min_length=1, max_length=200)


class MistakeUpdate(BaseModel):
    node_id: PyObjectId | None = None
    tag: MistakeTag | None = None
    question: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)
    resolved: bool | None = None


class Mistake(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    source_type: MistakeSourceType
    source_id: PyObjectId | None = None
    node_id: PyObjectId
    #: Denormalised from the node on write. Nodes cannot move between subjects,
    #: so this cannot go stale, and it keeps the subject filter and the summary
    #: off a lookup on every read.
    subject: Subject
    date: str
    question: str = ""
    tag: MistakeTag
    note: str = ""
    resolved: bool = False
    resolved_at: datetime | None = None
    created_at: datetime | None = None
    #: Joined on read so a row can say where it came from.
    node_title: str | None = None
    node_path: str | None = None
    source_title: str | None = None


class MistakePage(BaseModel):
    items: list[Mistake]
    next_cursor: str | None = None


class TagCount(BaseModel):
    tag: MistakeTag
    label: str
    count: int


class SubjectCount(BaseModel):
    subject: Subject
    count: int


class MistakeSummary(BaseModel):
    """The stacked bar at the top of the notebook.

    Every tag is present even at zero, so the bar keeps the same five segments
    in the same order however the counts move.
    """

    total: int
    unresolved: int
    by_tag: list[TagCount]
    by_subject: list[SubjectCount]
