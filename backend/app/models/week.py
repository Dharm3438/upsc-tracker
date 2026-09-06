"""The weekly plan.

What she means to do in a week, next to what she has actually done. The targets
are stored; the actuals never are — they are counted from the logs on every
read, so the page cannot drift from what was logged and there is nothing to
recompute when a log is deleted.

A null target means "not tracked" rather than zero: an unset target draws no
meter, instead of one she is permanently failing.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

#: More topics than this in one week is a typo, not a plan.
MAX_COMMITMENTS = 40


class WeekTargets(BaseModel):
    new_topics: int | None = Field(default=None, ge=0, le=200)
    answers: int | None = Field(default=None, ge=0, le=200)
    mcqs: int | None = Field(default=None, ge=0, le=5000)
    study_minutes: int | None = Field(default=None, ge=0, le=10080)


class WeekPlanUpdate(BaseModel):
    """The whole plan, sent whole. It is four numbers and a short list, so a
    patch would be more machinery than it saves."""

    week_start: str | None = Field(default=None, pattern=DAY_PATTERN)
    targets: WeekTargets = Field(default_factory=WeekTargets)
    commitments: list[PyObjectId] = Field(
        default_factory=list, max_length=MAX_COMMITMENTS
    )


class Commitment(BaseModel):
    """A topic picked for the week, with its title resolved for the list."""

    node_id: PyObjectId
    title: str
    path: str
    #: Read or revised inside the week. Nothing here is ticked by hand.
    done: bool


class WeekActuals(BaseModel):
    new_topics: int = 0
    answers: int = 0
    mcqs: int = 0
    study_minutes: int = 0


class WeekSuggestion(BaseModel):
    """What the burn-down implies for a week of this many study days. Shown as
    a sentence, never filled in for her."""

    new_topics: int
    study_minutes: int


class Week(BaseModel):
    week_start: str
    week_end: str
    #: Days in the week she means to study on, after the standing weekly off
    #: and any specific days already written off.
    study_days: int
    targets: WeekTargets
    suggested: WeekSuggestion
    commitments: list[Commitment]
    actuals: WeekActuals
    updated_at: datetime | None = None
