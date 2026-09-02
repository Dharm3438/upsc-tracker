"""Activity log schemas.

One collection holds every study action. The shape is a thin envelope — node,
type, study day, minutes — around a per-type `payload`, so the node timeline is
a single query on `node_id` while each screen keeps the fields it actually
needs.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.dates import today_ist
from app.models.common import PyObjectId


class LogType(StrEnum):
    READ = "read"
    REVISE = "revise"
    MCQ = "mcq"
    ANSWER = "answer"
    CA = "ca"


class ReviseMethod(StrEnum):
    NOTES = "notes"
    BOOK = "book"
    RECALL = "recall"
    MINDMAP = "mindmap"


class ReadPayload(BaseModel):
    source: str = Field(default="", max_length=200)
    from_page: int | None = Field(default=None, ge=0)
    to_page: int | None = Field(default=None, ge=0)
    confidence: int = Field(ge=1, le=5)

    @model_validator(mode="after")
    def check_pages(self) -> "ReadPayload":
        if self.from_page is not None and self.to_page is not None:
            if self.to_page < self.from_page:
                raise ValueError("The last page cannot come before the first.")
        return self


class RevisePayload(BaseModel):
    confidence: int = Field(ge=1, le=5)
    method: ReviseMethod = ReviseMethod.RECALL


class McqPayload(BaseModel):
    test_id: PyObjectId | None = None
    attempted: int = Field(ge=0)
    correct: int = Field(ge=0)
    skipped: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def check_totals(self) -> "McqPayload":
        if self.correct > self.attempted:
            raise ValueError("More correct than attempted.")
        return self


class AnswerPayload(BaseModel):
    """Written by the answers screen (phase 5), never by the quick log sheet."""

    answer_id: PyObjectId


class CaPayload(BaseModel):
    """Written when a current-affairs item is tagged to a node (phase 6)."""

    ca_id: PyObjectId


PAYLOAD_MODELS: dict[LogType, type[BaseModel]] = {
    LogType.READ: ReadPayload,
    LogType.REVISE: RevisePayload,
    LogType.MCQ: McqPayload,
    LogType.ANSWER: AnswerPayload,
    LogType.CA: CaPayload,
}

#: Types whose side-effect touches `review_state`, and which therefore have to
#: be reversible on delete.
SCHEDULING_TYPES: frozenset[LogType] = frozenset({LogType.READ, LogType.REVISE})


class LogCreate(BaseModel):
    node_id: PyObjectId
    type: LogType
    date: str = Field(default_factory=today_ist, pattern=r"^\d{4}-\d{2}-\d{2}$")
    minutes: int | None = Field(default=None, ge=0, le=1440)
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_payload(self) -> "LogCreate":
        """Coerce the payload through the model for this type.

        Keeping payloads as a dict on the wire keeps one endpoint for all five
        types; validating here means a malformed payload is still a 422 rather
        than a surprise three screens later.
        """
        model = PAYLOAD_MODELS[self.type]
        self.payload = model(**self.payload).model_dump(mode="json")
        return self


class ReviewStateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_id: PyObjectId
    repetitions: int
    ease_factor: float
    interval_days: int
    last_reviewed: str | None = None
    next_due: str | None = None
    last_confidence: int | None = None
    lapses: int = 0


class Log(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    node_id: PyObjectId
    type: LogType
    date: str
    minutes: int | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    #: Filled in on cross-node listings; the node timeline already knows it.
    node_title: str | None = None
    node_path: str | None = None


class LogCreated(BaseModel):
    """POST /logs, with enough scheduling detail for the confirmation toast."""

    log: Log
    review_state: ReviewStateOut | None = None
    #: "Back on 23 Sep" — null when the log did not reschedule anything.
    next_due: str | None = None


class LogPage(BaseModel):
    items: list[Log]
    #: Pass back as `?cursor=` for the next page. Null at the end.
    next_cursor: str | None = None


class RecentNode(BaseModel):
    """A recently logged node, for the quick log sheet's shortcut row."""

    node_id: PyObjectId
    title: str
    path: str
    paper: str
    last_logged: str

    SHORTCUT_LIMIT: ClassVar[int] = 8
