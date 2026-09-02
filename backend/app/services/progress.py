"""The aggregations behind the Progress screen.

Four questions, and one idea holding them together: a day she planned not to
study is not a day she failed. Every pace figure here divides by *effective
study days* — the calendar days left minus her standing weekly off and minus
the specific days she has already written off — because dividing by calendar
days produces a target she was never going to meet and a chart that accuses her
for keeping a promise to herself.

The date maths is pure and lives at the top of this file, apart from the
database, because it is the part that has to be right.
"""

from typing import Any, Iterable

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import days_between, parse_day, shift_day, today_ist
from app.models.common import PAPER_LABELS, Paper
from app.models.settings import AppSettings

#: How far back the "actual pace" average looks. Short enough to reflect the
#: month she is having, long enough that one bad week does not define it.
PACE_WINDOW_DAYS = 28

#: A topic counts as revised at two revisions, matching the tree's threshold.
REVISED_THRESHOLD = 2

#: Weekly points on the burn-down. Daily would be 700 points for a two-year
#: prep, and the shape is a trend, not a diary.
SERIES_STEP_DAYS = 7

#: Give up projecting a finish date beyond this. A pace that slow is better
#: reported as "not on track" than as a date in 2031.
MAX_PROJECTION_DAYS = 1500

#: Log types that mean a topic has been opened at all.
STUDY_TYPES = ("read", "revise")


def is_study_day(day: str, off_days: Iterable[str], weekly_off: int | None) -> bool:
    """Whether a calendar day is one she intends to study on.

    `weekly_off` is Python's weekday numbering: 0 is Monday, 6 is Sunday.
    """
    if day in off_days:
        return False
    return weekly_off is None or parse_day(day).weekday() != weekly_off


def effective_study_days(
    start: str,
    end: str,
    off_days: Iterable[str] = (),
    weekly_off: int | None = None,
) -> int:
    """Study days in the window running from the day after `start` to `end`.

    `start` is today and is excluded: today is already half spent by the time
    she looks at this, and counting it inflates every pace figure. Returns 0
    once `end` is in the past.
    """
    total = days_between(start, end)
    if total <= 0:
        return 0
    off = set(off_days)
    return sum(
        1
        for offset in range(1, total + 1)
        if is_study_day(shift_day(start, offset), off, weekly_off)
    )


def _study_days_in(
    first: str, last: str, off_days: Iterable[str], weekly_off: int | None
) -> int:
    """Study days in a closed past window — both ends included.

    The mirror of `effective_study_days` for a window that has already
    happened, where today did count.
    """
    span = days_between(first, last)
    if span < 0:
        return 0
    off = set(off_days)
    return sum(
        1
        for offset in range(span + 1)
        if is_study_day(shift_day(first, offset), off, weekly_off)
    )


async def countdown(
    db: AsyncIOMotorDatabase,
    settings: AppSettings,
    *,
    date: str | None = None,
) -> dict[str, Any]:
    """Days to each exam, and how many of them she actually gets to study on."""
    day = date or today_ist()

    def to(exam: str) -> dict[str, Any]:
        return {
            "date": exam,
            "days": days_between(day, exam),
            "study_days": effective_study_days(
                day, exam, settings.off_days, settings.weekly_off_weekday
            ),
        }

    return {
        "date": day,
        "prelims": to(settings.prelims_date),
        "mains": to(settings.mains_date),
    }


async def _live_nodes(
    db: AsyncIOMotorDatabase, paper: str | None = None
) -> list[dict[str, Any]]:
    """Every unarchived node, with just the fields the aggregations need.

    One query for the whole syllabus. It is under a thousand small documents,
    and having the shape in memory makes "which of these are leaves" and "which
    section is this under" ordinary Python instead of two more pipelines.
    """
    query: dict[str, Any] = {"is_archived": False}
    if paper:
        query["paper"] = paper
    projection = {"paper": 1, "parent_id": 1, "title": 1, "level": 1, "order": 1}
    return await db.syllabus_nodes.find(query, projection).to_list(length=None)


def _leaves(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Nodes with nothing under them.

    A leaf is the unit of progress: a level-2 topic with no children counts as
    one, exactly as the tree's coverage does, so the two screens never disagree
    about how much syllabus there is.
    """
    parents = {node["parent_id"] for node in nodes if node.get("parent_id")}
    return [node for node in nodes if node["_id"] not in parents]


async def _first_touch(
    db: AsyncIOMotorDatabase, node_ids: list[ObjectId]
) -> dict[ObjectId, str]:
    """The day each topic was first opened, by reading or revising it."""
    pipeline = [
        {"$match": {"node_id": {"$in": node_ids}, "type": {"$in": list(STUDY_TYPES)}}},
        {"$group": {"_id": "$node_id", "first": {"$min": "$date"}}},
    ]
    return {row["_id"]: row["first"] async for row in db.logs.aggregate(pipeline)}


async def burndown(
    db: AsyncIOMotorDatabase,
    settings: AppSettings,
    *,
    date: str | None = None,
) -> dict[str, Any]:
    """Leaves remaining against the pace needed to clear them before Prelims.

    Two lines. `remaining` is what is actually left, plotted back to the day
    she started. `required` is where that line has to be on each date to reach
    zero by Prelims, anchored at the start of her history and falling in
    proportion to the study days left — so the gap between them is the honest
    answer to "am I behind", and an off-day bends the required line instead of
    counting against her.
    """
    day = date or today_ist()
    off_days, weekly_off = settings.off_days, settings.weekly_off_weekday
    exam = settings.prelims_date

    nodes = await _live_nodes(db)
    leaves = _leaves(nodes)
    total = len(leaves)
    touched = await _first_touch(db, [leaf["_id"] for leaf in leaves])

    started = sum(1 for when in touched.values() if when <= day)
    remaining = total - started
    days_left = effective_study_days(day, exam, off_days, weekly_off)

    # With no study days left the pace is not a rate any more; reporting the
    # whole remainder is the truthful version of "all of it, now".
    required = round(remaining / days_left, 3) if days_left else float(remaining)

    window_start, actual = _recent_pace(touched, day, off_days, weekly_off)

    return {
        "date": day,
        "total_leaves": total,
        "started_leaves": started,
        "remaining": remaining,
        "study_days_remaining": days_left,
        "required_per_day": required,
        "actual_per_day": actual,
        "actual_window_days": days_between(window_start, day) + 1,
        "projected_finish": _project(remaining, actual, day, off_days, weekly_off),
        "series": _series(touched, total, day, exam, off_days, weekly_off),
    }


def _recent_pace(
    touched: dict[ObjectId, str],
    day: str,
    off_days: Iterable[str],
    weekly_off: int | None,
) -> tuple[str, float | None]:
    """New topics per study day over the recent window.

    The window shortens to the length of her actual history when that is
    shorter, so a first week is not averaged over four.
    """
    window_start = shift_day(day, -(PACE_WINDOW_DAYS - 1))
    earliest = min(touched.values(), default=None)
    if earliest and earliest > window_start:
        window_start = earliest

    opened = sum(1 for when in touched.values() if window_start <= when <= day)
    study_days = _study_days_in(window_start, day, off_days, weekly_off)
    pace = round(opened / study_days, 3) if study_days else None
    return window_start, pace


def _project(
    remaining: int,
    pace: float | None,
    day: str,
    off_days: Iterable[str],
    weekly_off: int | None,
) -> str | None:
    """The day the current pace clears the syllabus, or None if it never does.

    Walked day by day rather than divided, because the answer has to skip her
    off-days to mean anything.
    """
    if not pace or remaining <= 0:
        return None
    off = set(off_days)
    left = float(remaining)
    for offset in range(1, MAX_PROJECTION_DAYS + 1):
        current = shift_day(day, offset)
        if is_study_day(current, off, weekly_off):
            left -= pace
            if left <= 0:
                return current
    return None


def _series(
    touched: dict[ObjectId, str],
    total: int,
    day: str,
    exam: str,
    off_days: Iterable[str],
    weekly_off: int | None,
) -> list[dict[str, Any]]:
    """Weekly points from the first day of study through to Prelims."""
    firsts = sorted(touched.values())
    start = min(firsts[0], day) if firsts else day

    dates: list[str] = []
    cursor = start
    while cursor < day:
        dates.append(cursor)
        cursor = shift_day(cursor, SERIES_STEP_DAYS)
    dates.append(day)
    cursor = shift_day(day, SERIES_STEP_DAYS)
    while cursor < exam:
        dates.append(cursor)
        cursor = shift_day(cursor, SERIES_STEP_DAYS)
    if exam > day:
        dates.append(exam)

    # The required line is anchored where the actual line starts, so the two
    # are comparable from the first point rather than only from today.
    anchor_remaining = total - sum(1 for when in firsts if when <= start)
    anchor_days = effective_study_days(start, exam, off_days, weekly_off)

    points: list[dict[str, Any]] = []
    for point in dates:
        left = effective_study_days(point, exam, off_days, weekly_off)
        required = anchor_remaining * (left / anchor_days) if anchor_days else 0.0
        points.append(
            {
                "date": point,
                "remaining": (
                    total - sum(1 for when in firsts if when <= point)
                    if point <= day
                    else None
                ),
                "required": round(required, 2),
            }
        )
    return points


async def coverage(
    db: AsyncIOMotorDatabase, *, date: str | None = None
) -> dict[str, Any]:
    """Per paper: how many leaves have been read, revised twice, and tested.

    "Tested" is wider than MCQs on purpose. A mains-heavy syllabus is examined
    by writing about it, so an answer written on a topic counts, as does a
    mistake recorded against it from a test — otherwise GS4 and the optional
    would read as permanently untested.
    """
    day = date or today_ist()
    nodes = await _live_nodes(db)
    leaves = {leaf["_id"]: leaf for leaf in _leaves(nodes)}
    leaf_ids = list(leaves)

    counts: dict[ObjectId, dict[str, int]] = {}
    pipeline = [
        {"$match": {"node_id": {"$in": leaf_ids}, "date": {"$lte": day}}},
        {"$group": {"_id": {"node": "$node_id", "type": "$type"}, "n": {"$sum": 1}}},
    ]
    async for row in db.logs.aggregate(pipeline):
        counts.setdefault(row["_id"]["node"], {})[row["_id"]["type"]] = row["n"]

    with_mistakes = set(
        await db.mistakes.distinct("node_id", {"node_id": {"$in": leaf_ids}})
    )

    tally: dict[str, dict[str, int]] = {}
    for node_id, leaf in leaves.items():
        row = tally.setdefault(
            leaf["paper"], {"leaves": 0, "read": 0, "revised": 0, "tested": 0}
        )
        row["leaves"] += 1
        seen = counts.get(node_id, {})
        if seen.get("read", 0) >= 1:
            row["read"] += 1
        if seen.get("revise", 0) >= REVISED_THRESHOLD:
            row["revised"] += 1
        if seen.get("mcq", 0) or seen.get("answer", 0) or node_id in with_mistakes:
            row["tested"] += 1

    papers = [
        {"paper": paper.value, "label": PAPER_LABELS[paper], **tally[paper.value]}
        for paper in Paper
        if paper.value in tally
    ]
    return {
        "date": day,
        "papers": papers,
        "totals": {
            "paper": Paper.GS1.value,
            "label": "All papers",
            "leaves": sum(row["leaves"] for row in tally.values()),
            "read": sum(row["read"] for row in tally.values()),
            "revised": sum(row["revised"] for row in tally.values()),
            "tested": sum(row["tested"] for row in tally.values()),
        },
    }


async def heatmap(
    db: AsyncIOMotorDatabase, *, paper: str | None = None, date: str | None = None
) -> dict[str, Any]:
    """Every leaf as a square, grouped under its section.

    Coloured by confidence, which is depth of fill rather than a traffic light:
    a syllabus that is mostly pale is one that is mostly unrevised, which is
    what a first year looks like and not a failure.
    """
    day = date or today_ist()
    nodes = await _live_nodes(db, paper)
    by_id = {node["_id"]: node for node in nodes}
    leaves = _leaves(nodes)

    def section_of(node: dict[str, Any]) -> str:
        current = node
        while current.get("parent_id") and current["parent_id"] in by_id:
            current = by_id[current["parent_id"]]
        return current["title"]

    states: dict[ObjectId, dict[str, Any]] = {}
    cursor = db.review_state.find(
        {"node_id": {"$in": [leaf["_id"] for leaf in leaves]}},
        {"node_id": 1, "last_confidence": 1, "next_due": 1},
    )
    async for state in cursor:
        states[state["node_id"]] = state

    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    rank: dict[tuple[str, str], tuple[int, int]] = {}
    ordered = sorted(leaves, key=lambda n: (n["paper"], n.get("order", 0), n["title"]))
    for leaf in ordered:
        key = (leaf["paper"], section_of(leaf))
        rank.setdefault(key, (list(Paper).index(Paper(leaf["paper"])), len(rank)))
        state = states.get(leaf["_id"])
        due = state.get("next_due") if state else None
        grouped.setdefault(key, []).append(
            {
                "node_id": leaf["_id"],
                "title": leaf["title"],
                "paper": leaf["paper"],
                "section": key[1],
                "confidence": state.get("last_confidence") if state else None,
                "started": state is not None,
                "next_due": due,
                "days_overdue": max(0, days_between(due, day)) if due else 0,
            }
        )

    sections = [
        {
            "paper": key[0],
            "label": PAPER_LABELS[Paper(key[0])],
            "section": key[1],
            "cells": cells,
        }
        for key, cells in sorted(grouped.items(), key=lambda item: rank[item[0]])
    ]
    return {"date": day, "sections": sections}


async def effort(
    db: AsyncIOMotorDatabase,
    settings: AppSettings,
    *,
    days: int = 30,
    date: str | None = None,
) -> dict[str, Any]:
    """Minutes studied per day, with planned off-days marked rather than zeroed.

    The plan calls this the streakless summary, and the name is the design:
    there is no streak to break here, only a month of days, some of which were
    never going to be study days.
    """
    day = date or today_ist()
    first = shift_day(day, -(days - 1))

    pipeline = [
        {"$match": {"date": {"$gte": first, "$lte": day}}},
        {
            "$group": {
                "_id": "$date",
                "minutes": {"$sum": {"$ifNull": ["$minutes", 0]}},
                "logs": {"$sum": 1},
            }
        },
    ]
    rows = {row["_id"]: row async for row in db.logs.aggregate(pipeline)}

    off = set(settings.off_days)
    series: list[dict[str, Any]] = []
    for offset in range(days):
        current = shift_day(first, offset)
        row = rows.get(current, {})
        series.append(
            {
                "date": current,
                "minutes": row.get("minutes", 0),
                "logs": row.get("logs", 0),
                "off": not is_study_day(current, off, settings.weekly_off_weekday),
            }
        )

    studied = [row for row in series if not row["off"]]
    average = (
        round(sum(row["minutes"] for row in studied) / len(studied)) if studied else 0
    )
    return {
        "date": day,
        "days": series,
        "total_minutes": sum(row["minutes"] for row in series),
        "average_minutes": average,
        "study_days": len(studied),
    }
