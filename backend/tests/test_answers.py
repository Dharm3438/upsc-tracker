"""Answer writing: the redo rule, the log it leaves, and the header trends.

The redo rule is the risk here. It is a ratio of the marks allotted, not the
plan's literal "under five", so 7/20 has to queue and 6/10 has to not — and it
has to keep behaving when the score is corrected later.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models import answers as schema
from app.services import answers as answer_service
from app.services import nodes as node_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
TODAY = "2026-09-02"
THIRTY_DAYS_ON = "2026-10-02"


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
        db, paper="GS2", title="Polity", parent_id=None, pyq_weight="high"
    )
    topic = await node_service.create_node(
        db, paper="GS2", title="Federalism", parent_id=str(section["_id"])
    )
    return str(topic["_id"])


@pytest_asyncio.fixture
async def section(db) -> str:
    node = await node_service.create_node(
        db, paper="GS3", title="Economy", parent_id=None
    )
    return str(node["_id"])


def written(node_id: str, **overrides) -> schema.AnswerCreate:
    fields = {
        "date": TODAY,
        "node_id": node_id,
        "question": "Cooperative federalism is a means, not an end. Comment.",
        "marks_allotted": 15,
        "word_limit": 250,
        "words_written": 238,
        "minutes_taken": 9,
    }
    return schema.AnswerCreate(**{**fields, **overrides})


async def test_create_denormalises_the_paper_and_joins_the_title(db, node):
    doc = await answer_service.create_answer(db, written(node))

    assert doc["paper"] == "GS2"
    assert doc["node_title"] == "Federalism"
    assert doc["reviewed"] is False


async def test_an_unmarked_answer_has_no_redo_date(db, node):
    doc = await answer_service.create_answer(db, written(node))

    assert doc["self_score"] is None
    assert doc["review_due"] is None


async def test_scoring_under_half_queues_it_thirty_days_out(db, node):
    doc = await answer_service.create_answer(db, written(node, self_score=6))

    assert doc["review_due"] == THIRTY_DAYS_ON


async def test_the_threshold_is_a_ratio_not_the_number_five(db, node):
    """7/20 is a weak answer; 6/10 is not. A literal "< 5" gets both wrong."""
    weak = await answer_service.create_answer(
        db, written(node, marks_allotted=20, self_score=7)
    )
    fine = await answer_service.create_answer(
        db, written(node, marks_allotted=10, self_score=6)
    )

    assert weak["review_due"] == THIRTY_DAYS_ON
    assert fine["review_due"] is None


async def test_scoring_after_the_fact_sets_the_redo_date(db, node):
    """The timer saves an unmarked answer; the score arrives as a patch."""
    doc = await answer_service.create_answer(db, written(node))

    scored = await answer_service.update_answer(
        db, str(doc["_id"]), schema.AnswerUpdate(self_score=4)
    )

    assert scored["review_due"] == THIRTY_DAYS_ON


async def test_raising_the_score_clears_the_redo_date(db, node):
    doc = await answer_service.create_answer(db, written(node, self_score=4))

    fixed = await answer_service.update_answer(
        db, str(doc["_id"]), schema.AnswerUpdate(self_score=11)
    )

    assert fixed["review_due"] is None


async def test_a_score_cannot_beat_the_marks_allotted(db, node):
    doc = await answer_service.create_answer(db, written(node))

    with pytest.raises(answer_service.AnswerError):
        await answer_service.update_answer(
            db, str(doc["_id"]), schema.AnswerUpdate(self_score=16)
        )


async def test_rescoring_reopens_a_reviewed_answer(db, node):
    """A rewritten answer is scored again — the queue entry should not stay
    ticked off against the old score."""
    doc = await answer_service.create_answer(db, written(node, self_score=4))
    await answer_service.update_answer(
        db, str(doc["_id"]), schema.AnswerUpdate(reviewed=True)
    )

    rescored = await answer_service.update_answer(
        db, str(doc["_id"]), schema.AnswerUpdate(self_score=5)
    )

    assert rescored["reviewed"] is False
    assert rescored["review_due"] == THIRTY_DAYS_ON


async def test_the_review_queue_holds_only_what_is_due_and_unreviewed(db, node):
    due = await answer_service.create_answer(
        db, written(node, date="2026-08-01", self_score=4)
    )
    await answer_service.create_answer(db, written(node, self_score=4))  # due later
    await answer_service.create_answer(db, written(node, self_score=12))  # never due
    done = await answer_service.create_answer(
        db, written(node, date="2026-08-01", self_score=4)
    )
    await answer_service.update_answer(
        db, str(done["_id"]), schema.AnswerUpdate(reviewed=True)
    )

    queue = await answer_service.review_queue(db, today=TODAY)

    assert [doc["_id"] for doc in queue] == [due["_id"]]


async def test_writing_an_answer_logs_it_against_the_node(db, node):
    doc = await answer_service.create_answer(db, written(node))

    log = await db.logs.find_one({"type": "answer"})
    assert log["node_id"] == doc["node_id"]
    assert log["minutes"] == 9
    assert log["payload"]["answer_id"] == str(doc["_id"])


async def test_correcting_the_date_moves_the_log_with_it(db, node):
    doc = await answer_service.create_answer(db, written(node))

    await answer_service.update_answer(
        db, str(doc["_id"]), schema.AnswerUpdate(date="2026-08-30", minutes_taken=14)
    )

    log = await db.logs.find_one({"type": "answer"})
    assert log["date"] == "2026-08-30"
    assert log["minutes"] == 14


async def test_delete_takes_the_log_and_the_mistakes_with_it(db, node):
    doc = await answer_service.create_answer(db, written(node))
    await db.mistakes.insert_one(
        {"source_type": "answer", "source_id": doc["_id"], "node_id": doc["node_id"]}
    )

    await answer_service.delete_answer(db, str(doc["_id"]))

    assert await db.logs.count_documents({"type": "answer"}) == 0
    assert await db.mistakes.count_documents({}) == 0


async def test_an_answer_cannot_hang_off_a_whole_section(db, section):
    with pytest.raises(answer_service.AnswerError):
        await answer_service.create_answer(db, written(section))


async def test_trends_average_minutes_and_the_score_ratio(db, node):
    await answer_service.create_answer(
        db, written(node, minutes_taken=8, marks_allotted=10, self_score=5)
    )
    await answer_service.create_answer(
        db, written(node, minutes_taken=12, marks_allotted=20, self_score=15)
    )

    computed = await answer_service.trends(db)

    assert computed["average_minutes"] == 10.0
    # 0.5 and 0.75 — comparable only because they are ratios.
    assert computed["scores"] == [0.5, 0.75]
    assert computed["average_score"] == 0.625


async def test_an_unscored_answer_still_counts_towards_the_minutes_trend(db, node):
    await answer_service.create_answer(db, written(node, minutes_taken=11))

    computed = await answer_service.trends(db)

    assert computed["minutes"] == [11]
    assert computed["scores"] == []
    assert computed["average_score"] is None


async def test_the_list_pages_newest_first(db, node):
    first = await answer_service.create_answer(db, written(node))
    second = await answer_service.create_answer(db, written(node))

    page, cursor = await answer_service.list_answers(db, limit=1)

    assert [doc["_id"] for doc in page] == [second["_id"]]
    assert cursor == str(second["_id"])

    rest, _ = await answer_service.list_answers(db, limit=1, cursor=cursor)
    assert [doc["_id"] for doc in rest] == [first["_id"]]


async def test_an_image_has_to_be_a_link(db, node):
    with pytest.raises(ValueError):
        written(node, image_urls=["C:/Users/her/answer.jpg"])
