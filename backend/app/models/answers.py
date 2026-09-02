"""Mains answer-writing schemas.

Two numbers carry this collection: minutes taken and the self-score. Everything
else is context for them. The self-score is out of `marks_allotted` rather than
out of ten, because that is how the answer was actually marked — which makes
"scored under half" a ratio, and makes a 6.5/15 and a 9/20 comparable.

The redo rule is the only derived field: an answer she rated under half comes
back thirty days later. It is computed on every write for the same reason the
test arithmetic is — one definition, server-side, that no client can drift from.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.dates import shift_day, today_ist
from app.models.common import Paper, PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

#: Below this share of the marks allotted, the answer goes into the redo queue.
#: A ratio rather than the plan's literal "< 5": a 4/10 and a 7/20 are the same
#: answer, and only one of them is below five.
REDO_THRESHOLD = 0.5

#: How long an answer rests before she rewrites it. Long enough that she is
#: rewriting it rather than remembering it.
REDO_AFTER_DAYS = 30

MAX_IMAGES = 6


def _check_url(value: str) -> str:
    """Only a link — v1 stores no files (plan §3.6). A Drive URL is the point."""
    cleaned = value.strip()
    if cleaned and not cleaned.startswith(("http://", "https://")):
        raise ValueError("Paste a link starting with http:// or https://")
    return cleaned


class AnswerBase(BaseModel):
    node_id: PyObjectId
    question: str = Field(min_length=1, max_length=4000)
    marks_allotted: float = Field(default=15, gt=0, le=250)
    word_limit: int | None = Field(default=None, ge=0, le=5000)
    words_written: int | None = Field(default=None, ge=0, le=5000)
    minutes_taken: int | None = Field(default=None, ge=0, le=600)
    #: Out of `marks_allotted`. Null while the answer is written but unmarked.
    self_score: float | None = Field(default=None, ge=0)
    peer_score: float | None = Field(default=None, ge=0)
    #: Typed straight in, for the days she practises on a laptop.
    text: str = Field(default="", max_length=20000)
    #: Photographs of the sheet, as links. No uploads in v1.
    image_urls: list[str] = Field(default_factory=list, max_length=MAX_IMAGES)
    model_answer_url: str = Field(default="", max_length=500)
    improvements: str = Field(default="", max_length=4000)

    @field_validator("image_urls")
    @classmethod
    def check_images(cls, value: list[str]) -> list[str]:
        return [_check_url(url) for url in value if url.strip()]

    @field_validator("model_answer_url")
    @classmethod
    def check_model_answer(cls, value: str) -> str:
        return _check_url(value)

    @model_validator(mode="after")
    def check_scores(self) -> "AnswerBase":
        for name in ("self_score", "peer_score"):
            score = getattr(self, name)
            if score is not None and score > self.marks_allotted:
                raise ValueError("A score cannot beat the marks allotted.")
        return self


class AnswerCreate(AnswerBase):
    date: str = Field(default_factory=today_ist, pattern=DAY_PATTERN)


class AnswerUpdate(BaseModel):
    """Every field optional. Scores are checked against the merged document in
    the service, because raising `self_score` alone is only wrong in the light
    of the `marks_allotted` already stored."""

    date: str | None = Field(default=None, pattern=DAY_PATTERN)
    node_id: PyObjectId | None = None
    question: str | None = Field(default=None, min_length=1, max_length=4000)
    marks_allotted: float | None = Field(default=None, gt=0, le=250)
    word_limit: int | None = Field(default=None, ge=0, le=5000)
    words_written: int | None = Field(default=None, ge=0, le=5000)
    minutes_taken: int | None = Field(default=None, ge=0, le=600)
    self_score: float | None = Field(default=None, ge=0)
    peer_score: float | None = Field(default=None, ge=0)
    text: str | None = Field(default=None, max_length=20000)
    image_urls: list[str] | None = Field(default=None, max_length=MAX_IMAGES)
    model_answer_url: str | None = Field(default=None, max_length=500)
    improvements: str | None = Field(default=None, max_length=4000)
    #: Set true from the redo queue once she has rewritten it.
    reviewed: bool | None = None

    @field_validator("image_urls")
    @classmethod
    def check_images(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [_check_url(url) for url in value if url.strip()]

    @field_validator("model_answer_url")
    @classmethod
    def check_model_answer(cls, value: str | None) -> str | None:
        return None if value is None else _check_url(value)


class Answer(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    date: str
    node_id: PyObjectId
    #: Denormalised from the node on write, exactly as a mistake's is: the list
    #: filters by paper on every read and nodes never change paper.
    paper: Paper
    question: str
    marks_allotted: float
    word_limit: int | None = None
    words_written: int | None = None
    minutes_taken: int | None = None
    self_score: float | None = None
    peer_score: float | None = None
    text: str = ""
    image_urls: list[str] = Field(default_factory=list)
    model_answer_url: str = ""
    improvements: str = ""
    #: Set thirty days out when she scored under half; null otherwise.
    review_due: str | None = None
    reviewed: bool = False
    reviewed_at: datetime | None = None
    created_at: datetime | None = None
    #: Joined on read so a row can say which topic it came from.
    node_title: str | None = None
    node_path: str | None = None


class AnswerTrends(BaseModel):
    """The two header trends of plan §8.5, over the last twenty answers.

    Scores are ratios of the marks allotted, so a 15-marker and a 20-marker sit
    on the same line.
    """

    count: int = 0
    average_minutes: float | None = None
    average_score: float | None = None
    #: Oldest first, so both sparklines read left to right the way time does.
    minutes: list[int] = Field(default_factory=list)
    scores: list[float] = Field(default_factory=list)


class AnswerPage(BaseModel):
    items: list[Answer]
    next_cursor: str | None = None
    trends: AnswerTrends = Field(default_factory=AnswerTrends)


def redo_due(date: str, marks_allotted: float, self_score: float | None) -> str | None:
    """When this answer should come back, or None if it should not.

    An unmarked answer has no redo date: the queue is for answers she judged
    weak, not for ones she has not judged yet.
    """
    if self_score is None or marks_allotted <= 0:
        return None
    if self_score / marks_allotted >= REDO_THRESHOLD:
        return None
    return shift_day(date, REDO_AFTER_DAYS)


def apply_redo(doc: dict[str, Any]) -> dict[str, Any]:
    """Set `review_due` from the score. The one derived field on the document."""
    doc["review_due"] = redo_due(
        doc["date"], doc["marks_allotted"], doc.get("self_score")
    )
    return doc
