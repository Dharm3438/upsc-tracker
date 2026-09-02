"""Test attempt schemas.

Entry speed is the whole design constraint here: after a mock she has a score
sheet in front of her and no patience. So the client sends only what it cannot
derive — total, attempted, correct — and everything else (wrong, skipped,
accuracy, marks) is computed on write. That also means two clients can never
disagree about what accuracy means.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.dates import today_ist
from app.models.common import Paper, PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

#: UPSC deducts a third of a question's marks for a wrong answer. Used when the
#: client does not state a penalty, which is the normal case.
NEGATIVE_FRACTION = 1 / 3


class TestKind(StrEnum):
    SECTIONAL = "sectional"
    FULL_MOCK = "full_mock"
    DAILY_QUIZ = "daily_quiz"
    CSAT = "csat"


class TestBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: TestKind = TestKind.SECTIONAL
    papers: list[Paper] = Field(default_factory=list)
    total_questions: int = Field(ge=1, le=1000)
    attempted: int = Field(ge=0, le=1000)
    correct: int = Field(ge=0, le=1000)
    max_marks: float | None = Field(default=None, ge=0)
    #: Marks lost per wrong answer. Left out, it is a third of a question's
    #: marks — 0.66 on the usual 100-question, 200-mark Prelims paper.
    negative_per_wrong: float | None = Field(default=None, ge=0)
    #: Stated only when the score sheet disagrees with the arithmetic, e.g. a
    #: paper with bonus marks for a dropped question.
    marks: float | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=600)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def check_counts(self) -> "TestBase":
        if self.attempted > self.total_questions:
            raise ValueError("More attempted than the paper had.")
        if self.correct > self.attempted:
            raise ValueError("More correct than attempted.")
        return self


class TestCreate(TestBase):
    date: str = Field(default_factory=today_ist, pattern=DAY_PATTERN)


class TestUpdate(BaseModel):
    """Every field optional, but the counts still have to agree.

    They are checked against the stored document in the service, because a
    patch that raises `correct` alone is only invalid in the light of the
    `attempted` already on record.
    """

    date: str | None = Field(default=None, pattern=DAY_PATTERN)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: TestKind | None = None
    papers: list[Paper] | None = None
    total_questions: int | None = Field(default=None, ge=1, le=1000)
    attempted: int | None = Field(default=None, ge=0, le=1000)
    correct: int | None = Field(default=None, ge=0, le=1000)
    max_marks: float | None = Field(default=None, ge=0)
    negative_per_wrong: float | None = Field(default=None, ge=0)
    marks: float | None = None
    duration_minutes: int | None = Field(default=None, ge=0, le=600)
    notes: str | None = Field(default=None, max_length=2000)


class Test(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    date: str
    title: str
    kind: TestKind
    papers: list[Paper] = Field(default_factory=list)
    total_questions: int
    attempted: int
    correct: int
    wrong: int
    skipped: int
    marks: float | None = None
    max_marks: float | None = None
    negative_per_wrong: float | None = None
    duration_minutes: int | None = None
    #: correct / attempted, 0.0 on a paper she did not attempt at all.
    accuracy: float = 0.0
    notes: str = ""
    created_at: datetime | None = None
    #: How many mistakes have been logged against this attempt. Filled in on
    #: the list and detail reads so the row can nudge: 27 wrong, 0 recorded.
    mistakes_logged: int = 0


class TestPage(BaseModel):
    items: list[Test]
    next_cursor: str | None = None
    #: Accuracy of the last ten attempts, oldest first — the header sparkline.
    trend: list[float] = Field(default_factory=list)
