"""Motor client and index creation.

Indexes are declared once here and created on startup, guarded so repeated
deploys are cheap (Mongo treats an identical create_index as a no-op).
"""

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel, TEXT

from app.config import get_settings

log = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


class DatabaseNotConfigured(RuntimeError):
    """Raised when MONGODB_URI is empty, so routes fail as 503 rather than 500."""

    def __init__(self) -> None:
        super().__init__("MONGODB_URI is not configured.")


INDEXES: dict[str, list[IndexModel]] = {
    "syllabus_nodes": [
        IndexModel([("paper", ASCENDING), ("order", ASCENDING)]),
        IndexModel([("parent_id", ASCENDING)]),
        IndexModel([("paper", ASCENDING), ("seed_key", ASCENDING)], unique=True,
                   partialFilterExpression={"seed_key": {"$type": "string"}}),
        IndexModel([("is_archived", ASCENDING)]),
        IndexModel([("path", TEXT)]),
    ],
    "logs": [
        IndexModel([("node_id", ASCENDING), ("date", DESCENDING)]),
        IndexModel([("type", ASCENDING), ("date", DESCENDING)]),
        IndexModel([("date", DESCENDING)]),
    ],
    "review_state": [
        IndexModel([("node_id", ASCENDING)], unique=True),
        IndexModel([("next_due", ASCENDING)]),
    ],
    "tests": [
        IndexModel([("date", DESCENDING)]),
        IndexModel([("kind", ASCENDING)]),
    ],
    "mistakes": [
        IndexModel([("node_id", ASCENDING), ("date", DESCENDING)]),
        IndexModel([("tag", ASCENDING)]),
        IndexModel([("paper", ASCENDING), ("date", DESCENDING)]),
        # Counting a test's mistakes for its row, and cascading them on delete.
        IndexModel([("source_id", ASCENDING)]),
        IndexModel([("resolved", ASCENDING)]),
        IndexModel([("question", TEXT), ("note", TEXT)]),
    ],
    "answers": [
        IndexModel([("date", DESCENDING)]),
        IndexModel([("review_due", ASCENDING), ("reviewed", ASCENDING)]),
    ],
    "ca_items": [
        IndexModel([("month", ASCENDING), ("date", DESCENDING)]),
        IndexModel([("node_id", ASCENDING)]),
        IndexModel([("tagged", ASCENDING)]),
    ],
    "pyqs": [
        IndexModel([("node_ids", ASCENDING)]),
        IndexModel([("year", DESCENDING), ("paper", ASCENDING)]),
    ],
    "sources": [IndexModel([("status", ASCENDING)])],
    "weekly_reviews": [IndexModel([("week_start", DESCENDING)], unique=True)],
}


def connect() -> AsyncIOMotorDatabase:
    """Create the client. Lazy so importing the app never dials out."""
    global _client, _db
    settings = get_settings()
    if not settings.mongodb_uri:
        raise DatabaseNotConfigured
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
        _db = _client[settings.mongodb_db]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        return connect()
    return _db


async def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
        _client, _db = None, None


async def ensure_indexes() -> None:
    db = get_db()
    for collection, models in INDEXES.items():
        await db[collection].create_indexes(models)
    log.info("indexes ensured on %d collections", len(INDEXES))


async def ping() -> bool:
    """Round-trip to Mongo. Used by /health."""
    try:
        await get_db().command("ping")
        return True
    except Exception:  # noqa: BLE001 - health check must never raise
        log.exception("mongo ping failed")
        return False
