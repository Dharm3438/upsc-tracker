"""The revision queue.

`services/sm2.py` is unit-tested on its own numbers; this covers the join it
feeds — which nodes surface, in what order, and how the forecast counts them.
Needs a real Mongo for the aggregation, so it skips without MONGODB_URI.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.logs import LogCreate
from app.services import logs as log_service
from app.services import nodes as node_service
from app.services import review as review_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
TODAY = "2026-09-02"
TOMORROW = "2026-09-03"


@pytest_asyncio.fixture(scope="module")
async def client():
    uri = get_settings().mongodb_uri
    if not uri:
        pytest.skip("MONGODB_URI is not set")
    connection = AsyncIOMotorClient(uri, tz_aware=True)
    try:
        yield connection
    finally:
        await connection.drop_database(TEST_DB)
        connection.close()


@pytest_asyncio.fixture
async def db(client):
    assert TEST_DB.endswith("_test"), "refusing to drop a non-test database"
    await client.drop_database(TEST_DB)
    return client[TEST_DB]


@pytest_asyncio.fixture
async def topic(db) -> str:
    section = await node_service.create_node(
        db, subject="POLITY", title="Polity", parent_id=None, pyq_weight="high"
    )
    return str(section["_id"])


async def leaf(db, topic: str, title: str, weight: str = "medium") -> str:
    """A level-2 topic under the seeded section — the shallowest loggable level."""
    doc = await node_service.create_node(
        db, subject="POLITY", title=title, parent_id=topic, pyq_weight=weight
    )
    return str(doc["_id"])


async def graded(db, node_id: str, confidence: int, date: str = TODAY) -> None:
    await log_service.create_log(
        db,
        LogCreate(
            node_id=node_id, type="revise", date=date,
            payload={"confidence": confidence, "method": "recall"},
        ),
    )


async def read(db, node_id: str, confidence: int = 4, date: str = TODAY) -> None:
    await log_service.create_log(
        db,
        LogCreate(
            node_id=node_id, type="read", date=date,
            payload={"confidence": confidence, "source": "Laxmikanth"},
        ),
    )


class TestDue:
    async def test_an_unread_topic_is_never_due(self, db, topic):
        await leaf(db, topic, "Federalism")
        result = await review_service.due(db, date=TODAY)
        assert result == {"date": TODAY, "total": 0, "items": []}

    async def test_a_first_read_surfaces_tomorrow_not_today(self, db, topic):
        await read(db, await leaf(db, topic, "Federalism"))
        assert (await review_service.due(db, date=TODAY))["total"] == 0
        assert (await review_service.due(db, date=TOMORROW))["total"] == 1

    async def test_the_weakest_topic_comes_first(self, db, topic):
        strong = await leaf(db, topic, "Emergency provisions")
        weak = await leaf(db, topic, "Federalism")
        # Both land on tomorrow: a lapse returns at once, and a 5 on a node
        # with no repetitions behind it is also a one-day interval.
        await graded(db, strong, 5, date=TODAY)
        await graded(db, weak, 2, date=TODAY)

        items = (await review_service.due(db, date=TOMORROW))["items"]
        assert [row["title"] for row in items] == ["Federalism", "Emergency provisions"]
        assert items[0]["last_confidence"] == 2

    async def test_pyq_weight_breaks_a_tie_on_confidence(self, db, topic):
        low = await leaf(db, topic, "Zonal Councils", weight="low")
        high = await leaf(db, topic, "Centre-State relations", weight="high")
        await graded(db, low, 3)
        await graded(db, high, 3)

        items = (await review_service.due(db, date=TOMORROW))["items"]
        assert [row["title"] for row in items] == [
            "Centre-State relations",
            "Zonal Councils",
        ]

    async def test_a_reading_confidence_orders_the_queue_too(self, db, topic):
        """A first read records how well it landed, and that counts as the
        node's confidence until it is first graded."""
        await graded(db, await leaf(db, topic, "Emergency provisions"), 4)
        await read(db, await leaf(db, topic, "Federalism"), confidence=1)

        items = (await review_service.due(db, date=TOMORROW))["items"]
        assert [row["title"] for row in items] == ["Federalism", "Emergency provisions"]
        assert items[0]["last_confidence"] == 1
        assert items[0]["repetitions"] == 0

    async def test_lateness_is_counted_in_days(self, db, topic):
        await graded(db, await leaf(db, topic, "Federalism"), 2)
        items = (await review_service.due(db, date="2026-09-20"))["items"]
        assert items[0]["next_due"] == TOMORROW
        assert items[0]["days_overdue"] == 17

    async def test_an_archived_topic_stops_surfacing(self, db, topic):
        node_id = await leaf(db, topic, "Federalism")
        await graded(db, node_id, 2)
        await node_service.archive_node(db, node_id)
        assert (await review_service.due(db, date=TOMORROW))["total"] == 0

    async def test_the_total_ignores_the_limit(self, db, topic):
        for title in ("Federalism", "Emergency provisions", "Zonal Councils"):
            await graded(db, await leaf(db, topic, title), 2)

        result = await review_service.due(db, date=TOMORROW, limit=2)
        assert result["total"] == 3
        assert len(result["items"]) == 2

    async def test_the_row_carries_what_the_grading_sheet_needs(self, db, topic):
        node_id = await leaf(db, topic, "Federalism", weight="high")
        await node_service.update_node(db, node_id, {"notes": "Art 246 and 254."})
        await graded(db, node_id, 2)

        row = (await review_service.due(db, date=TOMORROW))["items"][0]
        assert str(row["node_id"]) == node_id
        assert row["path"] == "POLITY/Polity/Federalism"
        assert row["subject"] == "POLITY"
        assert row["pyq_weight"] == "high"
        assert row["notes"] == "Art 246 and 254."
        assert row["lapses"] == 1


class TestUpcoming:
    async def test_every_day_in_the_window_is_present(self, db, topic):
        result = await review_service.upcoming(db, date=TODAY, days=7)
        assert [day["date"] for day in result["days"]] == [
            "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
            "2026-09-06", "2026-09-07", "2026-09-08",
        ]
        assert all(day["count"] == 0 for day in result["days"])

    async def test_counts_land_on_the_day_they_are_due(self, db, topic):
        # A 5 on a fresh node is one day out; the second 5, graded on that
        # day, is six more — so it lands on the 9th, not the 8th.
        node_id = await leaf(db, topic, "Federalism")
        await graded(db, node_id, 5)
        await graded(db, node_id, 5, date=TOMORROW)

        result = await review_service.upcoming(db, date=TODAY, days=10)
        counts = {day["date"]: day["count"] for day in result["days"]}
        assert counts["2026-09-09"] == 1
        assert sum(counts.values()) == 1

    async def test_a_backlog_sits_outside_the_daily_counts(self, db, topic):
        await graded(db, await leaf(db, topic, "Federalism"), 2)

        result = await review_service.upcoming(db, date="2026-09-20", days=7)
        assert result["overdue"] == 1
        assert all(day["count"] == 0 for day in result["days"])

    async def test_beyond_the_window_is_not_counted(self, db, topic):
        await graded(db, await leaf(db, topic, "Federalism"), 5)
        result = await review_service.upcoming(db, date=TODAY, days=1)
        assert result["overdue"] == 0
        assert result["days"] == [{"date": TODAY, "count": 0}]

    async def test_archived_topics_are_left_out(self, db, topic):
        node_id = await leaf(db, topic, "Federalism")
        await graded(db, node_id, 5)
        await node_service.archive_node(db, node_id)
        result = await review_service.upcoming(db, date=TODAY, days=7)
        assert sum(day["count"] for day in result["days"]) == 0
