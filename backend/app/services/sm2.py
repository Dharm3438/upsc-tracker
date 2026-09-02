"""Spaced repetition (SM-2), plan §4.

Pure functions over plain dataclasses: no database, no clock. The scheduler is
the one real algorithm in this app, so it is kept where it can be tested by
reading the numbers off the page.

Two deliberate departures from textbook SM-2, both because a two-year campaign
is not the same problem as a vocabulary deck:

1. Intervals are capped, so a topic can never vanish for a year.
2. Intervals compress as Prelims approaches — passed in as a factor rather than
   read from a clock, so the behaviour stays testable.
"""

from dataclasses import dataclass

from app.dates import shift_day

INITIAL_EASE = 2.5
MIN_EASE = 1.3

#: A topic UPSC asks about often may not disappear for more than a quarter.
CAP_WEIGHTED_DAYS = 90
CAP_DEFAULT_DAYS = 180
WEIGHTED = frozenset({"high", "medium"})

#: Inside this many days of Prelims, every new interval is halved.
COMPRESSION_WINDOW_DAYS = 60
COMPRESSION_FACTOR = 0.5

#: Below this, the answer did not come back and the topic restarts.
LAPSE_QUALITY = 3


@dataclass(frozen=True)
class ReviewState:
    """The SM-2 state of one node. Defaults describe a node never revised."""

    repetitions: int = 0
    ease_factor: float = INITIAL_EASE
    interval_days: int = 0
    lapses: int = 0


@dataclass(frozen=True)
class Schedule:
    """The result of grading. `next_due` is a study day, not a timestamp."""

    repetitions: int
    ease_factor: float
    interval_days: int
    lapses: int
    next_due: str
    lapsed: bool


def cap_for(pyq_weight: str) -> int:
    return CAP_WEIGHTED_DAYS if pyq_weight in WEIGHTED else CAP_DEFAULT_DAYS


def compression_for(days_to_prelims: int | None) -> float:
    """1.0 normally; 0.5 once Prelims is inside the compression window.

    A `None` exam date, or an exam already past, leaves intervals alone — the
    scheduler should not start behaving oddly because a date was left unset.
    """
    if days_to_prelims is None or days_to_prelims < 0:
        return 1.0
    return COMPRESSION_FACTOR if days_to_prelims < COMPRESSION_WINDOW_DAYS else 1.0


def schedule(
    state: ReviewState | None,
    quality: int,
    *,
    today: str,
    pyq_weight: str = "medium",
    compression_factor: float = 1.0,
) -> Schedule:
    """Grade a review and return the next state.

    `quality` is the 1-5 confidence the UI collects, used directly as SM-2's
    q. A grade under 3 is a lapse: repetitions reset and the topic comes back
    tomorrow.
    """
    if not 1 <= quality <= 5:
        raise ValueError(f"confidence must be 1-5, got {quality}")

    current = state or ReviewState()
    lapsed = quality < LAPSE_QUALITY

    if lapsed:
        repetitions = 0
        lapses = current.lapses + 1
        raw_interval = 1.0
    else:
        repetitions = current.repetitions + 1
        lapses = current.lapses
        if current.repetitions == 0:
            raw_interval = 1.0
        elif current.repetitions == 1:
            raw_interval = 6.0
        else:
            # Uses the ease from before this grading, per the SM-2 ordering.
            raw_interval = current.interval_days * current.ease_factor

    # The ease moves on every grade, including a lapse — that is what makes a
    # repeatedly-failed topic come back faster than a merely difficult one.
    ease = current.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(MIN_EASE, round(ease, 4))

    # A lapse returns tomorrow regardless; compressing or capping it is a no-op
    # that only risks rounding it to zero.
    if lapsed:
        interval = 1
    else:
        interval = max(1, round(raw_interval * compression_factor))
        interval = min(interval, cap_for(pyq_weight))

    return Schedule(
        repetitions=repetitions,
        ease_factor=ease,
        interval_days=interval,
        lapses=lapses,
        next_due=shift_day(today, interval),
        lapsed=lapsed,
    )


def first_read(today: str) -> Schedule:
    """A `read` log on an untracked node starts it: back tomorrow, unrated.

    Reading is not grading, so this deliberately does not touch the ease.
    """
    return Schedule(
        repetitions=0,
        ease_factor=INITIAL_EASE,
        interval_days=1,
        lapses=0,
        next_due=shift_day(today, 1),
        lapsed=False,
    )
