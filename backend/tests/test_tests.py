"""Test attempts: the derived numbers, and what a delete takes with it.

The arithmetic is the whole risk here — a score sheet entered in three fields
has to produce the same accuracy and the same marks every time — so most of
this file is about what the server computes rather than what it stores.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models import tests as schema
from app.models.mistakes import MistakeBulk
from app.services import mistakes as mistake_service
from app.services import nodes as node_service
from app.services import tests as test_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
TODAY = "2026-09-02"


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
async def node(db) -> str:
    """A loggable topic, one level below a section."""
    section = await node_service.create_node(
        db, subject="POLITY", title="Polity", parent_id=None, pyq_weight="high"
    )
    topic = await node_service.create_node(
        db, subject="POLITY", title="Federalism", parent_id=str(section["_id"])
    )
    return str(topic["_id"])


def prelims(**overrides) -> schema.TestCreate:
    """The usual Prelims shape: 100 questions, 200 marks."""
    fields = {
        "date": TODAY,
        "title": "Vision IAS PT Test 6",
        "kind": "sectional",
        "subjects": ["GEOGRAPHY"],
        "total_questions": 100,
        "attempted": 84,
        "correct": 57,
        "max_marks": 200,
        "duration_minutes": 120,
    }
    return schema.TestCreate(**{**fields, **overrides})


class TestDerivedNumbers:
    async def test_wrong_and_skipped_come_from_the_three_counts(self, db):
        doc = await test_service.create_test(db, prelims())
        assert doc["wrong"] == 27  # 84 attempted - 57 correct
        assert doc["skipped"] == 16  # 100 in the subject - 84 attempted

    async def test_accuracy_is_over_attempted_not_over_the_subject(self, db):
        doc = await test_service.create_test(db, prelims())
        assert doc["accuracy"] == pytest.approx(57 / 84, abs=1e-4)

    async def test_an_unattempted_subject_scores_zero_rather_than_dividing_by_zero(
        self, db
    ):
        doc = await test_service.create_test(db, prelims(attempted=0, correct=0))
        assert doc["accuracy"] == 0.0

    async def test_the_penalty_defaults_to_a_third_of_a_question(self, db):
        doc = await test_service.create_test(db, prelims())
        assert doc["negative_per_wrong"] == pytest.approx(0.67, abs=0.01)

    async def test_marks_are_computed_from_the_counts_and_the_penalty(self, db):
        doc = await test_service.create_test(db, prelims())
        # 57 right at 2 marks, 27 wrong at 0.67 off each.
        assert doc["marks"] == pytest.approx(57 * 2 - 27 * 0.67, abs=0.01)

    async def test_a_stated_score_wins_over_the_arithmetic(self, db):
        """Bonus marks and dropped questions are real; the sum cannot know."""
        doc = await test_service.create_test(db, prelims(marks=99.5))
        assert doc["marks"] == 99.5

    async def test_no_max_marks_means_no_invented_score(self, db):
        doc = await test_service.create_test(db, prelims(max_marks=None))
        assert doc["marks"] is None
        assert doc["accuracy"] == pytest.approx(57 / 84, abs=1e-4)


class TestValidation:
    async def test_more_correct_than_attempted_is_rejected(self):
        with pytest.raises(ValueError):
            prelims(attempted=10, correct=11)

    async def test_more_attempted_than_the_subject_had_is_rejected(self):
        with pytest.raises(ValueError):
            prelims(total_questions=100, attempted=101, correct=1)

    async def test_a_patch_is_checked_against_the_stored_counts(self, db):
        doc = await test_service.create_test(db, prelims(attempted=10, correct=5))
        with pytest.raises(test_service.TestError):
            # Valid on its own; impossible against the 10 already stored.
            await test_service.update_test(
                db, str(doc["_id"]), schema.TestUpdate(correct=11)
            )


class TestUpdates:
    async def test_editing_a_count_re_derives_the_score(self, db):
        doc = await test_service.create_test(db, prelims())
        updated = await test_service.update_test(
            db, str(doc["_id"]), schema.TestUpdate(correct=60)
        )
        assert updated["wrong"] == 24
        assert updated["marks"] == pytest.approx(60 * 2 - 24 * 0.67, abs=0.01)

    async def test_a_corrected_score_survives_an_unrelated_edit(self, db):
        doc = await test_service.create_test(db, prelims(marks=99.5))
        updated = await test_service.update_test(
            db, str(doc["_id"]), schema.TestUpdate(title="Renamed")
        )
        assert updated["marks"] == 99.5
        assert updated["title"] == "Renamed"


class TestListing:
    async def test_attempts_come_back_newest_first(self, db):
        await test_service.create_test(db, prelims(title="First"))
        await test_service.create_test(db, prelims(title="Second"))
        docs, _ = await test_service.list_tests(db)
        assert [doc["title"] for doc in docs] == ["Second", "First"]

    async def test_the_trend_runs_oldest_to_newest(self, db):
        await test_service.create_test(db, prelims(attempted=10, correct=5))
        await test_service.create_test(db, prelims(attempted=10, correct=9))
        assert await test_service.accuracy_trend(db) == [0.5, 0.9]

    async def test_an_unattempted_subject_is_left_out_of_the_trend(self, db):
        """A zero there is an absence of data, not a collapse in accuracy."""
        await test_service.create_test(db, prelims(attempted=10, correct=5))
        await test_service.create_test(db, prelims(attempted=0, correct=0))
        assert await test_service.accuracy_trend(db) == [0.5]

    async def test_a_row_carries_how_many_mistakes_are_recorded(self, db, node):
        doc = await test_service.create_test(db, prelims())
        await mistake_service.add_test_mistakes(
            db,
            str(doc["_id"]),
            MistakeBulk(items=[{"node_id": node, "tag": "silly"}]),
        )
        docs, _ = await test_service.list_tests(db)
        assert docs[0]["mistakes_logged"] == 1


class TestDeletion:
    async def test_deleting_an_attempt_takes_its_mistakes_with_it(self, db, node):
        doc = await test_service.create_test(db, prelims())
        test_id = str(doc["_id"])
        await mistake_service.add_test_mistakes(
            db,
            test_id,
            MistakeBulk(
                items=[
                    {"node_id": node, "tag": "silly"},
                    {"node_id": node, "tag": "unknown"},
                ]
            ),
        )
        await test_service.delete_test(db, test_id)

        assert await db.mistakes.count_documents({}) == 0
        with pytest.raises(test_service.TestError):
            await test_service.get_test(db, test_id)

    async def test_deleting_twice_is_a_404_not_a_silent_success(self, db):
        doc = await test_service.create_test(db, prelims())
        await test_service.delete_test(db, str(doc["_id"]))
        with pytest.raises(test_service.TestError) as caught:
            await test_service.delete_test(db, str(doc["_id"]))
        assert caught.value.status == 404
