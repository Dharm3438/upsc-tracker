"""The week's to-do list.

One document per week in `weekly_todos`, keyed by the Monday it starts on —
`settings.week_start_of` decides that, the same function the weekly review
already uses, so the list and the note written about it always mean the same
seven days.

The document is created by the first item added to it, so a week she never
writes a list for leaves nothing behind.
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import shift_day, today_ist
from app.models.week import TodoCreate, TodoUpdate
from app.services.settings import week_start_of


class WeekError(Exception):
    """A rejected write, turned into a 4xx by the router."""

    def __init__(self, message: str, status: int = 404) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


async def get_week(
    db: AsyncIOMotorDatabase, *, start: str | None = None
) -> dict[str, Any]:
    """The list for a week. A week with nothing written for it is an empty
    list, not a 404 — the screen has to draw either way."""
    week_start = week_start_of(start or today_ist())
    doc = await db.weekly_todos.find_one({"week_start": week_start}) or {}

    return {
        "week_start": week_start,
        "week_end": shift_day(week_start, 6),
        "todos": [
            {"id": item["id"], "text": item["text"], "done": item["done"]}
            for item in doc.get("todos", [])
        ],
        "updated_at": doc.get("updated_at"),
    }


async def add_todo(db: AsyncIOMotorDatabase, payload: TodoCreate) -> dict[str, Any]:
    """Append an item, creating the week's document if this is the first."""
    week_start = week_start_of(payload.week_start or today_ist())
    item = {"id": ObjectId(), "text": payload.text, "done": False}

    await db.weekly_todos.update_one(
        {"week_start": week_start},
        {
            "$push": {"todos": item},
            "$set": {"updated_at": datetime.now(UTC)},
            "$setOnInsert": {"week_start": week_start, "created_at": datetime.now(UTC)},
        },
        upsert=True,
    )
    return await get_week(db, start=week_start)


async def update_todo(
    db: AsyncIOMotorDatabase, week_start: str, todo_id: str, patch: TodoUpdate
) -> dict[str, Any]:
    """Rename an item or tick it. Sending neither leaves the list alone."""
    week = week_start_of(week_start)
    changes = {
        f"todos.$.{field}": value
        for field, value in patch.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not changes:
        return await get_week(db, start=week)

    result = await db.weekly_todos.update_one(
        {"week_start": week, "todos.id": _oid(todo_id)},
        {"$set": {**changes, "updated_at": datetime.now(UTC)}},
    )
    if result.matched_count == 0:
        raise WeekError("That item is no longer on the list.")
    return await get_week(db, start=week)


async def delete_todo(
    db: AsyncIOMotorDatabase, week_start: str, todo_id: str
) -> dict[str, Any]:
    """Remove an item. Deleting one that has already gone is not an error —
    two taps on the same cross mean the same thing as one."""
    week = week_start_of(week_start)
    await db.weekly_todos.update_one(
        {"week_start": week},
        {
            "$pull": {"todos": {"id": _oid(todo_id)}},
            "$set": {"updated_at": datetime.now(UTC)},
        },
    )
    return await get_week(db, start=week)


def _oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise WeekError("That is not an item id.", status=400)
    return ObjectId(value)
