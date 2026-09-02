"""The settings document and the weekly review.

Settings are a single document with a fixed id. Reading it when it does not
exist yet returns the defaults rather than a 404 — a fresh database has to be
able to draw a countdown on the first morning, before she has opened the
settings screen at all — and the defaults are only written down once she
changes something.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import parse_day, shift_day, today_ist
from app.models.settings import (
    SINGLETON_ID,
    AppSettings,
    SettingsUpdate,
    WeeklyReviewCreate,
)


class SettingsError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


async def get_settings(db: AsyncIOMotorDatabase) -> AppSettings:
    """The settings, or the defaults if nothing has been saved yet."""
    doc = await db.app_settings.find_one({"_id": SINGLETON_ID})
    if doc is None:
        return AppSettings()
    doc.pop("_id", None)
    return AppSettings(**doc)


async def update_settings(
    db: AsyncIOMotorDatabase, patch: SettingsUpdate
) -> AppSettings:
    """Write the fields that were actually sent, upserting the document."""
    sent = patch.model_dump(mode="json", exclude_unset=True)
    # An explicit null means "no standing weekly off", so it is kept. On every
    # other field a null is nothing to write, and overwriting a date with one
    # would leave the countdown without an exam to count to.
    changes = {
        field: value
        for field, value in sent.items()
        if value is not None or field == "weekly_off_weekday"
    }
    if not changes:
        return await get_settings(db)

    current = await get_settings(db)
    merged = current.model_dump(mode="json") | changes
    merged["updated_at"] = datetime.now(UTC)
    await db.app_settings.update_one(
        {"_id": SINGLETON_ID}, {"$set": merged}, upsert=True
    )
    return await get_settings(db)


def week_start_of(day: str) -> str:
    """The Monday on or before a study day.

    Weeks start on Monday because the review is written on the weekend about
    the week that just ended, and a Sunday-start week would split it in two.
    """
    return shift_day(day, -parse_day(day).weekday())


async def create_weekly_review(
    db: AsyncIOMotorDatabase, payload: WeeklyReviewCreate
) -> dict[str, Any]:
    """Save the three prompts with a snapshot of the week's numbers.

    Re-submitting the same week overwrites the prompts but keeps the original
    snapshot: the numbers describe the week, and rewriting the note two days
    later should not silently restate them.
    """
    week = week_start_of(payload.week_start or today_ist())
    now = datetime.now(UTC)

    existing = await db.weekly_reviews.find_one({"week_start": week})
    prompts = payload.model_dump(mode="json", exclude={"week_start"})

    if existing is not None:
        await db.weekly_reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {**prompts, "updated_at": now}},
        )
        return await db.weekly_reviews.find_one({"_id": existing["_id"]})

    doc: dict[str, Any] = {
        "_id": ObjectId(),
        "week_start": week,
        **prompts,
        **await week_stats(db, week),
        "created_at": now,
        "updated_at": now,
    }
    await db.weekly_reviews.insert_one(doc)
    return doc


async def list_weekly_reviews(
    db: AsyncIOMotorDatabase, *, limit: int = 12
) -> list[dict[str, Any]]:
    """Newest first — the card on the Progress screen shows the last one and
    the history sits under it."""
    return await db.weekly_reviews.find().sort("week_start", -1).to_list(length=limit)


async def week_stats(db: AsyncIOMotorDatabase, week_start: str) -> dict[str, Any]:
    """The four numbers snapshotted onto a review.

    `nodes_covered` counts distinct topics touched by a reading in the week,
    not readings: three sittings on federalism is one topic covered.
    """
    week_end = shift_day(week_start, 6)
    span = {"$gte": week_start, "$lte": week_end}

    covered = await db.logs.distinct("node_id", {"type": "read", "date": span})
    revised = await db.logs.count_documents({"type": "revise", "date": span})
    answers = await db.answers.count_documents({"date": span})

    accuracy: float | None = None
    pipeline = [
        {"$match": {"date": span}},
        {
            "$group": {
                "_id": None,
                "attempted": {"$sum": "$attempted"},
                "correct": {"$sum": "$correct"},
            }
        },
    ]
    async for row in db.tests.aggregate(pipeline):
        if row["attempted"]:
            accuracy = round(row["correct"] / row["attempted"], 4)

    return {
        "nodes_covered": len(covered),
        "nodes_revised": revised,
        "answers_written": answers,
        "avg_accuracy": accuracy,
    }
