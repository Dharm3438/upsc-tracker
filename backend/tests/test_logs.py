"""Integration tests for logging and its side-effects.

These need a real Mongo: the whole point is what happens to `review_state`
around a write, and to the tree rollups afterwards. They run against a database
whose name ends in `_test` and drop it afterwards; without MONGODB_URI set they
skip.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.logs import LogCreate
from app.services import logs as log_service
from app.services import nodes as node_service
from app.services.logs import LogError
from app.services.rollups import subject_stats
from app.services.tree import build_tree

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
async def branch(db) -> dict[str, str]:
    """A POLITY branch: section → topic → two leaves."""
    section = await node_service.create_node(
        db, subject="POLITY", title="Polity", parent_id=None, pyq_weight="high"
    )
    topic = await node_service.create_node(
        db, subject="POLITY", title="Federalism", parent_id=str(section["_id"]),
        pyq_weight="high",
    )
    leaf_a = await node_service.create_node(
        db, subject="POLITY", title="Centre-State relations", parent_id=str(topic["_id"]),
        pyq_weight="high",
    )
    leaf_b = await node_service.create_node(
        db, subject="POLITY", title="Inter-State Council", parent_id=str(topic["_id"]),
        pyq_weight="low",
    )
    return {
        "section": str(section["_id"]),
        "topic": str(topic["_id"]),
        "leaf_a": str(leaf_a["_id"]),
        "leaf_b": str(leaf_b["_id"]),
    }


def read_log(node_id: str, confidence: int = 4, **extra) -> LogCreate:
    return LogCreate(
        node_id=node_id,
        type="read",
        date=TODAY,
        payload={"confidence": confidence, "source": "Laxmikanth", **extra},
    )


def revise_log(node_id: str, confidence: int, date: str = TODAY) -> LogCreate:
    return LogCreate(
        node_id=node_id, type="revise", date=date,
        payload={"confidence": confidence, "method": "recall"},
    )


async def state_of(db, node_id: str):
    from bson import ObjectId

    return await db.review_state.find_one({"node_id": ObjectId(node_id)})


class TestReadSideEffect:
    async def test_a_first_read_starts_the_schedule(self, db, branch):
        _, state = await log_service.create_log(db, read_log(branch["leaf_a"]))
        assert state["next_due"] == TOMORROW
        assert state["repetitions"] == 0
        assert state["interval_days"] == 1
        assert state["last_confidence"] == 4

    async def test_a_second_read_does_not_push_the_next_revision_out(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 5))
        after_revise = await state_of(db, branch["leaf_a"])

        await log_service.create_log(db, read_log(branch["leaf_a"]))
        after_second_read = await state_of(db, branch["leaf_a"])
        assert after_second_read["next_due"] == after_revise["next_due"]


class TestReviseSideEffect:
    async def test_grading_reschedules_through_sm2(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        _, state = await log_service.create_log(db, revise_log(branch["leaf_a"], 5))
        assert state["interval_days"] == 1
        assert state["repetitions"] == 1
        assert state["ease_factor"] == pytest.approx(2.6)

    async def test_a_low_grade_counts_a_lapse(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        _, state = await log_service.create_log(db, revise_log(branch["leaf_a"], 2))
        assert state["lapses"] == 1
        assert state["next_due"] == TOMORROW

    async def test_revising_an_untouched_node_still_works(self, db, branch):
        """She may grade something she read before the app existed."""
        _, state = await log_service.create_log(db, revise_log(branch["leaf_b"], 4))
        assert state["repetitions"] == 1


class TestDeleteReversal:
    async def test_deleting_a_first_read_removes_the_schedule(self, db, branch):
        doc, _ = await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.delete_log(db, str(doc["_id"]))
        assert await state_of(db, branch["leaf_a"]) is None

    async def test_deleting_a_revision_restores_the_previous_state(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 5))
        before = await state_of(db, branch["leaf_a"])
        before.pop("_id")

        doc, _ = await log_service.create_log(db, revise_log(branch["leaf_a"], 2))
        after = await log_service.delete_log(db, str(doc["_id"]))

        restored = await state_of(db, branch["leaf_a"])
        restored.pop("_id")
        assert restored == before
        assert after is None

    async def test_deleting_a_stale_entry_is_refused(self, db, branch):
        """Restoring an old snapshot would throw away the newer grading."""
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        older, _ = await log_service.create_log(db, revise_log(branch["leaf_a"], 5))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))

        with pytest.raises(LogError) as caught:
            await log_service.delete_log(db, str(older["_id"]))
        assert caught.value.status == 409

    async def test_deleting_a_second_read_leaves_the_schedule_alone(self, db, branch):
        """It never touched the schedule, so removing it must not either."""
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        before = await state_of(db, branch["leaf_a"])
        doc, _ = await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.delete_log(db, str(doc["_id"]))

        after = await state_of(db, branch["leaf_a"])
        assert after == before

    async def test_deleting_an_mcq_log_is_not_blocked_by_revisions(self, db, branch):
        mcq = LogCreate(
            node_id=branch["leaf_a"], type="mcq", date=TODAY,
            payload={"attempted": 10, "correct": 7, "skipped": 2},
        )
        doc, state = await log_service.create_log(db, mcq)
        assert state is None
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))
        await log_service.delete_log(db, str(doc["_id"]))
        assert await db.logs.count_documents({"type": "mcq"}) == 0


class TestRejections:
    async def test_a_top_level_topic_can_be_logged_against(self, db, branch):
        # The seeded syllabus is flat — a chapter or lecture is a level-1 node —
        # so depth is no longer what decides whether something is a study unit.
        doc, _ = await log_service.create_log(db, read_log(branch["section"]))
        assert str(doc["node_id"]) == branch["section"]

    async def test_an_archived_topic_is_refused(self, db, branch):
        await node_service.archive_node(db, branch["leaf_b"])
        with pytest.raises(LogError) as caught:
            await log_service.create_log(db, read_log(branch["leaf_b"]))
        assert caught.value.status == 409

    async def test_a_missing_topic_is_a_404(self, db):
        with pytest.raises(LogError) as caught:
            await log_service.create_log(db, read_log("68b6f1a2c3d4e5f6a7b8c9d0"))
        assert caught.value.status == 404

    async def test_deleting_a_missing_log_is_a_404(self, db):
        with pytest.raises(LogError) as caught:
            await log_service.delete_log(db, "68b6f1a2c3d4e5f6a7b8c9d0")
        assert caught.value.status == 404


class TestListing:
    async def test_the_timeline_is_newest_first(self, db, branch):
        for confidence in (1, 2, 3):
            await log_service.create_log(db, read_log(branch["leaf_a"], confidence))
        docs, cursor = await log_service.list_logs(db, node_id=branch["leaf_a"])
        assert [d["payload"]["confidence"] for d in docs] == [3, 2, 1]
        assert cursor is None

    async def test_the_cursor_walks_the_whole_history(self, db, branch):
        for confidence in (1, 2, 3, 4, 5):
            await log_service.create_log(db, read_log(branch["leaf_a"], confidence))

        seen, cursor = [], None
        for _ in range(5):
            docs, cursor = await log_service.list_logs(
                db, node_id=branch["leaf_a"], limit=2, cursor=cursor
            )
            seen.extend(d["payload"]["confidence"] for d in docs)
            if cursor is None:
                break
        assert seen == [5, 4, 3, 2, 1]
        assert cursor is None

    async def test_filtering_by_type_and_node(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))
        await log_service.create_log(db, read_log(branch["leaf_b"]))

        docs, _ = await log_service.list_logs(db, log_type="revise")
        assert len(docs) == 1
        docs, _ = await log_service.list_logs(db, node_id=branch["leaf_b"])
        assert len(docs) == 1

    async def test_cross_node_listings_carry_the_topic_title(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        docs, _ = await log_service.list_logs(db, with_node=True)
        assert docs[0]["node_title"] == "Centre-State relations"
        assert docs[0]["node_path"] == "POLITY/Polity/Federalism/Centre-State relations"


class TestRecentNodes:
    async def test_each_node_appears_once_newest_first(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, read_log(branch["leaf_b"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))

        rows = await log_service.recent_nodes(db)
        assert [row["title"] for row in rows] == [
            "Centre-State relations",
            "Inter-State Council",
        ]

    async def test_archived_topics_drop_out_of_the_shortcuts(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_b"]))
        await node_service.archive_node(db, branch["leaf_b"])
        assert await log_service.recent_nodes(db) == []


class TestRollups:
    async def test_counts_and_accuracy_reach_the_tree(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))
        await log_service.create_log(
            db,
            LogCreate(
                node_id=branch["leaf_a"], type="mcq", date=TODAY,
                payload={"attempted": 10, "correct": 7},
            ),
        )

        stats = await subject_stats(db, "POLITY")
        leaf = stats[branch["leaf_a"]]
        assert leaf["read_count"] == 1
        assert leaf["revise_count"] == 1
        assert leaf["mcq_accuracy"] == pytest.approx(0.7)
        assert leaf["confidence"] == 4
        assert leaf["last_touched"] == TODAY

    async def test_a_section_sums_the_leaves_below_it(self, db, branch):
        await log_service.create_log(db, read_log(branch["leaf_a"]))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 4))
        await log_service.create_log(db, revise_log(branch["leaf_a"], 5))

        docs = await db.syllabus_nodes.find({"subject": "POLITY"}).to_list(length=None)
        roots = build_tree(docs, await subject_stats(db, "POLITY"))

        section = roots[0]
        assert section.leaf_count == 2
        assert section.leaf_started == 1
        # Two revisions is the threshold for counting as revised.
        assert section.leaf_revised == 1

    async def test_an_untouched_subject_has_empty_stats(self, db, branch):
        assert await subject_stats(db, "POLITY") == {}
        assert await subject_stats(db, "GEOGRAPHY") == {}
