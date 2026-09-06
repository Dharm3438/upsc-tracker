"""The weekly plan and the week's actual numbers.

One document per week in `weekly_plans`, keyed by the Monday it starts on —
`settings.week_start_of` decides that, the same function the weekly review
already uses, so the plan and the note written about it always mean the same
seven days.

Only the targets and the chosen topics are stored. Everything on the right of
the page is counted from the logs each time it is read.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import shift_day, today_ist
from app.models.settings import AppSettings
from app.models.week import WeekPlanUpdate
from app.services import progress as progress_service
from app.services.settings import week_start_of

#: What "done" means for a committed topic: opened at all inside the week.
STUDY_TYPES = ("read", "revise")


async def get_week(
    db: AsyncIOMotorDatabase,
    settings: AppSettings,
    *,
    start: str | None = None,
    date: str | None = None,
) -> dict[str, Any]:
    """The plan for a week, its suggestion, and what has been done so far."""
    day = date or today_ist()
    week_start = week_start_of(start or day)
    week_end = shift_day(week_start, 6)

    plan = await db.weekly_plans.find_one({"week_start": week_start}) or {}
    study_days = progress_service.study_days_in(
        week_start, week_end, settings.off_days, settings.weekly_off_weekday
    )
    topics = await progress_service.first_touch_summary(
        db, first=week_start, last=week_end, on=day
    )

    return {
        "week_start": week_start,
        "week_end": week_end,
        "study_days": study_days,
        "targets": plan.get("targets", {}),
        "suggested": _suggestion(settings, topics["remaining"], study_days, day),
        "commitments": await _commitments(
            db, plan.get("commitments", []), week_start, week_end
        ),
        "actuals": await _actuals(db, week_start, week_end, topics["new_in_window"]),
        "updated_at": plan.get("updated_at"),
    }


async def save_plan(
    db: AsyncIOMotorDatabase, settings: AppSettings, payload: WeekPlanUpdate
) -> dict[str, Any]:
    """Write the whole plan for a week, then hand back the week as it now
    stands — the caller is a screen that has to redraw either way."""
    week_start = week_start_of(payload.week_start or today_ist())
    now = datetime.now(UTC)

    # Duplicates are a double tap on the same chip, not a plan to read it twice.
    seen: list[ObjectId] = []
    for node_id in payload.commitments:
        oid = ObjectId(node_id)
        if oid not in seen:
            seen.append(oid)

    await db.weekly_plans.update_one(
        {"week_start": week_start},
        {
            "$set": {
                "targets": payload.targets.model_dump(mode="json"),
                "commitments": seen,
                "updated_at": now,
            },
            "$setOnInsert": {"week_start": week_start, "created_at": now},
        },
        upsert=True,
    )
    return await get_week(db, settings, start=week_start)


def _suggestion(
    settings: AppSettings, remaining: int, study_days: int, day: str
) -> dict[str, int]:
    """The pace the burn-down asks for, scaled to this week's study days.

    It is only ever shown as a sentence. Filling the field in for her would
    make the target the app's rather than hers, and a target she did not choose
    is one she has no reason to keep.
    """
    days_left = progress_service.effective_study_days(
        day, settings.prelims_date, settings.off_days, settings.weekly_off_weekday
    )
    per_day = remaining / days_left if days_left else float(remaining)
    return {
        "new_topics": round(per_day * study_days),
        "study_minutes": settings.daily_targets.study_minutes * study_days,
    }


async def _commitments(
    db: AsyncIOMotorDatabase,
    node_ids: list[ObjectId],
    week_start: str,
    week_end: str,
) -> list[dict[str, Any]]:
    """The chosen topics, in the order they were chosen, each marked done if a
    reading or revision landed on it inside the week.

    A topic that has since been deleted or archived drops out of the list
    rather than showing as an untitled row she cannot act on.
    """
    if not node_ids:
        return []

    span = {"$gte": week_start, "$lte": week_end}
    query = {"_id": {"$in": node_ids}, "is_archived": False}
    nodes = {
        node["_id"]: node
        async for node in db.syllabus_nodes.find(query, {"title": 1, "path": 1})
    }
    done = set(
        await db.logs.distinct(
            "node_id",
            {"node_id": {"$in": node_ids}, "type": {"$in": list(STUDY_TYPES)}, "date": span},
        )
    )

    return [
        {
            "node_id": node_id,
            "title": nodes[node_id]["title"],
            "path": nodes[node_id].get("path", ""),
            "done": node_id in done,
        }
        for node_id in node_ids
        if node_id in nodes
    ]


async def _actuals(
    db: AsyncIOMotorDatabase, week_start: str, week_end: str, new_topics: int
) -> dict[str, int]:
    """Minutes, MCQs and answers for the week. `new_topics` is passed in
    because the caller has already paid for the query that answers it."""
    span = {"$gte": week_start, "$lte": week_end}

    totals = {"minutes": 0, "mcqs": 0}
    pipeline = [
        {"$match": {"date": span}},
        {
            "$group": {
                "_id": None,
                "minutes": {"$sum": {"$ifNull": ["$minutes", 0]}},
                # Only mcq logs carry an attempted count; the rest sum as zero.
                "mcqs": {"$sum": {"$ifNull": ["$payload.attempted", 0]}},
            }
        },
    ]
    async for row in db.logs.aggregate(pipeline):
        totals = row

    return {
        "new_topics": new_topics,
        "answers": await db.answers.count_documents({"date": span}),
        "mcqs": totals["mcqs"],
        "study_minutes": totals["minutes"],
    }
