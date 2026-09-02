"""The single settings document, and the weekly review.

Both are here because both are about the shape of the campaign rather than a
day's work: the exam dates and off-days that turn a countdown into an honest
one, and the Sunday note about what slipped.

`weekly_off_weekday` is Python's numbering — 0 is Monday, 6 is Sunday — which
is what `date.weekday()` returns and what the effective-days maths compares
against. The frontend converts; nothing here does.
"""

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.common import PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

SINGLETON_ID = "singleton"

#: Plan §3.10. Real dates for the 2027 attempt, editable in settings.
DEFAULT_PRELIMS = "2027-05-30"
DEFAULT_MAINS = "2027-09-17"


class DailyTargets(BaseModel):
    """What a full day looks like. Nothing enforces these — they are the
    denominator on the Today rows, not a rule."""

    revision_nodes: int = Field(default=6, ge=0, le=100)
    answers: int = Field(default=2, ge=0, le=20)
    mcqs: int = Field(default=25, ge=0, le=500)
    ca_items: int = Field(default=5, ge=0, le=100)
    study_minutes: int = Field(default=420, ge=0, le=1440)


class AppSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prelims_date: str = Field(default=DEFAULT_PRELIMS, pattern=DAY_PATTERN)
    mains_date: str = Field(default=DEFAULT_MAINS, pattern=DAY_PATTERN)
    daily_targets: DailyTargets = Field(default_factory=DailyTargets)
    #: Days already spoken for — a wedding, an illness, a planned break. They
    #: come out of the study-day count instead of being logged as failures.
    off_days: list[str] = Field(default_factory=list)
    #: 0 = Monday … 6 = Sunday. None means no standing weekly off.
    weekly_off_weekday: int | None = Field(default=6, ge=0, le=6)
    timezone: str = "Asia/Kolkata"
    updated_at: datetime | None = None


class SettingsUpdate(BaseModel):
    """Every field optional; only what is sent is written."""

    prelims_date: str | None = Field(default=None, pattern=DAY_PATTERN)
    mains_date: str | None = Field(default=None, pattern=DAY_PATTERN)
    daily_targets: DailyTargets | None = None
    off_days: list[str] | None = None
    weekly_off_weekday: int | None = Field(default=None, ge=0, le=6)

    @field_validator("off_days")
    @classmethod
    def clean_off_days(cls, value: list[str] | None) -> list[str] | None:
        """Deduplicated and sorted, so the stored list matches what she sees
        and a double tap cannot add the same day twice."""
        if value is None:
            return None
        for day in value:
            if not re.fullmatch(DAY_PATTERN, day):
                raise ValueError(f"invalid day: {day!r}")
        return sorted(set(value))


class WeeklyReviewCreate(BaseModel):
    """Three prompts. The statistics are the server's to fill in."""

    week_start: str | None = Field(default=None, pattern=DAY_PATTERN)
    what_slipped: str = Field(default="", max_length=2000)
    what_to_replan: str = Field(default="", max_length=2000)
    one_change: str = Field(default="", max_length=2000)

    @field_validator("what_slipped", "what_to_replan", "one_change")
    @classmethod
    def trim(cls, value: str) -> str:
        return value.strip()


class WeeklyReview(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    #: The Monday the week began, in IST.
    week_start: str
    what_slipped: str = ""
    what_to_replan: str = ""
    one_change: str = ""
    #: Snapshotted when the review is written, never recomputed: the point of
    #: the history is what the week looked like at the time.
    nodes_covered: int = 0
    nodes_revised: int = 0
    answers_written: int = 0
    avg_accuracy: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
