"""Read models for the Progress screen.

None of these are stored. Each one is the shape of a single question the screen
asks — how much is left, how much is covered, how strong each topic is, and
what the last month of effort actually looked like — computed by
`services/progress.py` and never written back.
"""

from pydantic import BaseModel, Field

from app.models.common import Paper, PyObjectId


class ExamCountdown(BaseModel):
    """Days to an exam, and the honest version of that number."""

    date: str
    #: Calendar days from today. Negative once the exam is behind her.
    days: int
    #: Days left after off-days and the standing weekly off come out. This is
    #: the figure every pace calculation divides by.
    study_days: int


class Countdown(BaseModel):
    date: str
    prelims: ExamCountdown
    mains: ExamCountdown


class BurndownPoint(BaseModel):
    date: str
    #: Leaves not yet started as of this date. Null in the future, where there
    #: is nothing to report yet — the chart draws the actual line up to today.
    remaining: int | None = None
    #: Where the line has to be on this date to reach zero by Prelims, given
    #: the study days between here and there.
    required: float


class Burndown(BaseModel):
    date: str
    total_leaves: int
    started_leaves: int
    remaining: int
    study_days_remaining: int
    #: Leaves per study day needed from today to finish before Prelims.
    required_per_day: float
    #: Leaves per study day actually started over the recent window. Null until
    #: there is a window's worth of history to average.
    actual_per_day: float | None = None
    #: How many days the window measured, so the screen can say "over 28 days".
    actual_window_days: int
    #: Where the current pace lands. Null if nothing is moving.
    projected_finish: str | None = None
    series: list[BurndownPoint] = Field(default_factory=list)


class PaperCoverage(BaseModel):
    """One paper's three bars, as counts rather than percentages — the screen
    needs the denominator to say "41 of 96"."""

    paper: Paper
    label: str
    leaves: int
    read: int
    revised: int
    tested: int


class Coverage(BaseModel):
    date: str
    papers: list[PaperCoverage] = Field(default_factory=list)
    totals: PaperCoverage | None = None


class HeatmapCell(BaseModel):
    """One leaf, as a square. Tapping it opens the node."""

    node_id: PyObjectId
    title: str
    paper: Paper
    #: The level-1 ancestor, so the grid can be grouped under section headings.
    section: str
    #: 1-5, or null for a topic never graded. Null draws as an empty square,
    #: which is a different thing from a weak one.
    confidence: int | None = None
    started: bool = False
    next_due: str | None = None
    days_overdue: int = 0


class HeatmapSection(BaseModel):
    paper: Paper
    label: str
    section: str
    cells: list[HeatmapCell] = Field(default_factory=list)


class Heatmap(BaseModel):
    date: str
    sections: list[HeatmapSection] = Field(default_factory=list)


class EffortDay(BaseModel):
    date: str
    minutes: int = 0
    logs: int = 0
    #: A planned off-day is drawn as marked, not as a zero. The distinction is
    #: the whole point of tracking off-days instead of streaks.
    off: bool = False


class Effort(BaseModel):
    date: str
    days: list[EffortDay] = Field(default_factory=list)
    total_minutes: int = 0
    #: Averaged over study days only, so a fortnight's planned break does not
    #: read as a collapse in effort.
    average_minutes: int = 0
    study_days: int = 0
