"""The mistake notebook: bulk entry, filtering, and the tag breakdown.

The summary is the part worth guarding. It is the number she acts on — "most of
your wrong answers are careless, not knowledge gaps" — so it has to agree with
the list underneath it under every filter.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.db import INDEXES
from app.models import tests as test_schema
from app.models.mistakes import MistakeBulk, MistakeCreate, MistakeUpdate
from app.services import mistakes as mistake_service
from app.services import nodes as node_service
from app.services import tests as test_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
TODAY = "2026-09-02"
YESTERDAY = "2026-09-01"


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
    db = client[TEST_DB]
    # The free-text search needs the real index, so create the collection's
    # indexes rather than only the ones a plain find would use.
    await db.mistakes.create_indexes(INDEXES["mistakes"])
    return db


@pytest_asyncio.fixture
async def nodes(db) -> dict[str, str]:
    """One POLITY topic and one ECONOMICS topic, plus the POLITY section above them."""
    polity = await node_service.create_node(
        db, subject="POLITY", title="Polity", parent_id=None, pyq_weight="high"
    )
    federalism = await node_service.create_node(
        db, subject="POLITY", title="Federalism", parent_id=str(polity["_id"])
    )
    economy = await node_service.create_node(
        db, subject="ECONOMICS", title="Economy", parent_id=None
    )
    inflation = await node_service.create_node(
        db, subject="ECONOMICS", title="Inflation", parent_id=str(economy["_id"])
    )
    return {
        "section": str(polity["_id"]),
        "gs2": str(federalism["_id"]),
        "gs3": str(inflation["_id"]),
    }


@pytest_asyncio.fixture
async def attempt(db) -> str:
    doc = await test_service.create_test(
        db,
        test_schema.TestCreate(
            date=TODAY,
            title="Vision IAS PT Test 6",
            subjects=["POLITY"],
            total_questions=100,
            attempted=84,
            correct=57,
        ),
    )
    return str(doc["_id"])


async def add(db, attempt: str, node_id: str, tag: str, **extra) -> dict:
    docs = await mistake_service.add_test_mistakes(
        db, attempt, MistakeBulk(items=[{"node_id": node_id, "tag": tag, **extra}])
    )
    return docs[0]


class TestBulkEntry:
    async def test_the_whole_wrong_list_saves_in_one_request(self, db, nodes, attempt):
        docs = await mistake_service.add_test_mistakes(
            db,
            attempt,
            MistakeBulk(
                items=[
                    {"node_id": nodes["gs2"], "tag": "silly"},
                    {"node_id": nodes["gs2"], "tag": "unknown", "note": "Art 51A"},
                    {"node_id": nodes["gs3"], "tag": "misread"},
                ]
            ),
        )
        assert len(docs) == 3
        assert await db.mistakes.count_documents({}) == 3

    async def test_mistakes_are_dated_to_the_test_not_to_data_entry(
        self, db, nodes, attempt
    ):
        """Typed in on Sunday evening, they still belong to Saturday's subject."""
        doc = await add(db, attempt, nodes["gs2"], "silly")
        assert doc["date"] == TODAY

    async def test_the_subject_is_denormalised_from_the_node(self, db, nodes, attempt):
        doc = await add(db, attempt, nodes["gs3"], "guess")
        assert doc["subject"] == "ECONOMICS"

    async def test_a_whole_section_is_too_coarse_to_tag(self, db, nodes, attempt):
        with pytest.raises(mistake_service.MistakeError):
            await add(db, attempt, nodes["section"], "silly")

    async def test_adding_to_a_test_that_is_gone_is_a_404(self, db, nodes, attempt):
        await test_service.delete_test(db, attempt)
        with pytest.raises(mistake_service.MistakeError) as caught:
            await add(db, attempt, nodes["gs2"], "silly")
        assert caught.value.status == 404


class TestFilters:
    async def test_filtering_by_tag(self, db, nodes, attempt):
        await add(db, attempt, nodes["gs2"], "silly")
        await add(db, attempt, nodes["gs2"], "unknown")
        docs, _ = await mistake_service.list_mistakes(db, tag="silly")
        assert [doc["tag"] for doc in docs] == ["silly"]

    async def test_filtering_by_subject(self, db, nodes, attempt):
        await add(db, attempt, nodes["gs2"], "silly")
        await add(db, attempt, nodes["gs3"], "silly")
        docs, _ = await mistake_service.list_mistakes(db, subject="ECONOMICS")
        assert [doc["subject"] for doc in docs] == ["ECONOMICS"]

    async def test_free_text_searches_the_question_and_the_note(
        self, db, nodes, attempt
    ):
        await add(db, attempt, nodes["gs2"], "silly", note="Confused Art 51A(g)")
        await add(db, attempt, nodes["gs2"], "unknown", question="Zonal Councils")
        docs, _ = await mistake_service.list_mistakes(db, query_text="Zonal")
        assert [doc["question"] for doc in docs] == ["Zonal Councils"]

    async def test_rows_carry_the_topic_and_the_subject_they_came_from(
        self, db, nodes, attempt
    ):
        await add(db, attempt, nodes["gs2"], "silly")
        docs, _ = await mistake_service.list_mistakes(db)
        assert docs[0]["node_title"] == "Federalism"
        assert docs[0]["source_title"] == "Vision IAS PT Test 6"

    async def test_a_renamed_topic_is_renamed_in_the_notebook(
        self, db, nodes, attempt
    ):
        """Titles are joined on read, not copied at write time."""
        await add(db, attempt, nodes["gs2"], "silly")
        await node_service.update_node(db, nodes["gs2"], {"title": "Centre-State"})
        docs, _ = await mistake_service.list_mistakes(db)
        assert docs[0]["node_title"] == "Centre-State"


class TestResolving:
    async def test_marking_one_settled_stamps_the_time(self, db, nodes, attempt):
        doc = await add(db, attempt, nodes["gs2"], "silly")
        updated = await mistake_service.update_mistake(
            db, str(doc["_id"]), MistakeUpdate(resolved=True)
        )
        assert updated["resolved"] is True
        assert updated["resolved_at"] is not None

    async def test_reopening_one_clears_the_stamp(self, db, nodes, attempt):
        doc = await add(db, attempt, nodes["gs2"], "silly")
        await mistake_service.update_mistake(
            db, str(doc["_id"]), MistakeUpdate(resolved=True)
        )
        reopened = await mistake_service.update_mistake(
            db, str(doc["_id"]), MistakeUpdate(resolved=False)
        )
        assert reopened["resolved_at"] is None

    async def test_re_filing_under_another_topic_moves_the_subject_too(
        self, db, nodes, attempt
    ):
        doc = await add(db, attempt, nodes["gs2"], "silly")
        moved = await mistake_service.update_mistake(
            db, str(doc["_id"]), MistakeUpdate(node_id=nodes["gs3"])
        )
        assert moved["subject"] == "ECONOMICS"


class TestSummary:
    async def test_every_tag_is_present_even_at_zero(self, db, nodes, attempt):
        await add(db, attempt, nodes["gs2"], "silly")
        result = await mistake_service.summary(db)
        assert [row["tag"] for row in result["by_tag"]] == [
            "unknown",
            "silly",
            "elimination",
            "misread",
            "guess",
        ]
        assert [row["count"] for row in result["by_tag"]] == [0, 1, 0, 0, 0]

    async def test_counts_split_by_tag_and_by_subject(self, db, nodes, attempt):
        await add(db, attempt, nodes["gs2"], "silly")
        await add(db, attempt, nodes["gs2"], "silly")
        await add(db, attempt, nodes["gs3"], "unknown")

        result = await mistake_service.summary(db)
        by_tag = {row["tag"]: row["count"] for row in result["by_tag"]}
        assert by_tag["silly"] == 2
        assert by_tag["unknown"] == 1
        assert result["by_subject"] == [
            {"subject": "POLITY", "count": 2},
            {"subject": "ECONOMICS", "count": 1},
        ]
        assert result["total"] == 3
        assert result["unresolved"] == 3

    async def test_a_settled_mistake_still_counts_but_not_as_unresolved(
        self, db, nodes, attempt
    ):
        doc = await add(db, attempt, nodes["gs2"], "silly")
        await mistake_service.update_mistake(
            db, str(doc["_id"]), MistakeUpdate(resolved=True)
        )
        result = await mistake_service.summary(db)
        assert result["total"] == 1
        assert result["unresolved"] == 0

    async def test_the_window_excludes_earlier_subjects(self, db, nodes):
        await mistake_service.create_mistake(
            db,
            MistakeCreate(node_id=nodes["gs2"], tag="silly", date=YESTERDAY),
        )
        await mistake_service.create_mistake(
            db,
            MistakeCreate(node_id=nodes["gs2"], tag="unknown", date=TODAY),
        )
        result = await mistake_service.summary(db, date_from=TODAY)
        assert result["total"] == 1

    async def test_the_subject_filter_narrows_the_summary_like_the_list(
        self, db, nodes, attempt
    ):
        await add(db, attempt, nodes["gs2"], "silly")
        await add(db, attempt, nodes["gs3"], "unknown")
        result = await mistake_service.summary(db, subject="POLITY")
        assert result["total"] == 1
        assert result["by_subject"] == [{"subject": "POLITY", "count": 1}]
