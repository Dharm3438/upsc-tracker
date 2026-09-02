"""Current affairs: capture, the inbox, and what tagging does to the timeline.

The acceptance criterion for the phase is two-sided — an item captured with a
headline and a note alone, and tagged to a node later from the inbox — so both
halves are covered here, along with the derived fields (`month`, `tagged`,
`paper`) that no client is allowed to set.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models import ca as schema
from app.services import ca as ca_service
from app.services import nodes as node_service

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


def captured(**overrides) -> schema.CaCreate:
    fields = {
        "date": TODAY,
        "headline": "Sixteenth Finance Commission constituted",
        "source": "The Hindu",
        "note": "Terms of reference include cess and surcharge share.",
    }
    return schema.CaCreate(**{**fields, **overrides})


async def test_capture_needs_only_a_headline(db):
    doc = await ca_service.create_item(
        db, schema.CaCreate(headline="Cabinet clears rail corridor")
    )

    assert doc["tagged"] is False
    assert doc["node_id"] is None
    assert doc["paper"] is None
    assert doc["note"] == ""


async def test_month_is_derived_from_the_date(db):
    doc = await ca_service.create_item(db, captured(date="2026-11-30"))

    assert doc["month"] == "2026-11"


async def test_untagged_items_wait_in_the_inbox(db):
    await ca_service.create_item(db, captured())
    await ca_service.create_item(db, captured(headline="Second item"))

    docs, total = await ca_service.inbox(db)

    assert total == 2
    # Oldest first: the inbox is a queue to empty, not a feed to read.
    assert [doc["headline"] for doc in docs] == [
        "Sixteenth Finance Commission constituted",
        "Second item",
    ]


async def test_tagging_from_the_inbox_clears_it_and_logs_the_node(db, node):
    item = await ca_service.create_item(db, captured())

    tagged = await ca_service.update_item(
        db, str(item["_id"]), schema.CaUpdate(node_id=node)
    )

    assert tagged["tagged"] is True
    assert tagged["paper"] == "GS2"
    assert tagged["node_title"] == "Federalism"
    assert await ca_service.untagged_count(db) == 0

    log = await db.logs.find_one({"type": "ca"})
    assert log is not None
    assert log["payload"]["ca_id"] == str(item["_id"])
    assert log["date"] == TODAY
    # Reading a newspaper is not measured against one topic.
    assert log["minutes"] is None


async def test_tagging_at_capture_time_also_logs(db, node):
    doc = await ca_service.create_item(db, captured(node_id=node))

    assert doc["tagged"] is True
    assert await db.logs.count_documents({"type": "ca"}) == 1


async def test_retagging_moves_the_log_rather_than_duplicating_it(db, node):
    other = await node_service.create_node(
        db, paper="GS2", title="Governance", parent_id=None
    )
    child = await node_service.create_node(
        db, paper="GS2", title="Transparency", parent_id=str(other["_id"])
    )
    item = await ca_service.create_item(db, captured(node_id=node))

    await ca_service.update_item(
        db, str(item["_id"]), schema.CaUpdate(node_id=str(child["_id"]))
    )

    logs = await db.logs.find({"type": "ca"}).to_list(length=None)
    assert len(logs) == 1
    assert logs[0]["node_id"] == child["_id"]


async def test_untagging_returns_it_to_the_inbox_and_drops_the_log(db, node):
    item = await ca_service.create_item(db, captured(node_id=node))

    back = await ca_service.update_item(
        db, str(item["_id"]), schema.CaUpdate(node_id=None)
    )

    assert back["tagged"] is False
    assert back["paper"] is None
    assert await db.logs.count_documents({"type": "ca"}) == 0


async def test_an_untouched_node_is_left_alone_by_an_unrelated_edit(db, node):
    """Starring an item must not read as an untag.

    `node_id=None` means "untag" only when the client actually sent it, which
    is the one thing `exclude_unset` is carrying here.
    """
    item = await ca_service.create_item(db, captured(node_id=node))

    starred = await ca_service.update_item(
        db, str(item["_id"]), schema.CaUpdate(starred=True)
    )

    assert starred["starred"] is True
    assert starred["tagged"] is True
    assert await db.logs.count_documents({"type": "ca"}) == 1


async def test_correcting_the_date_moves_the_month_and_the_log(db, node):
    item = await ca_service.create_item(db, captured(node_id=node))

    moved = await ca_service.update_item(
        db, str(item["_id"]), schema.CaUpdate(date="2026-08-29")
    )

    assert moved["month"] == "2026-08"
    log = await db.logs.find_one({"type": "ca"})
    assert log["date"] == "2026-08-29"


async def test_a_whole_section_is_too_coarse_to_tag(db, section):
    item = await ca_service.create_item(db, captured())

    with pytest.raises(ca_service.CaError) as caught:
        await ca_service.update_item(
            db, str(item["_id"]), schema.CaUpdate(node_id=section)
        )

    assert caught.value.status == 400


async def test_filters_narrow_by_month_node_and_paper(db, node):
    await ca_service.create_item(db, captured(date="2026-08-15"))
    await ca_service.create_item(db, captured(node_id=node))

    by_month, _ = await ca_service.list_items(db, month="2026-08")
    by_node, _ = await ca_service.list_items(db, node_id=node)
    by_paper, _ = await ca_service.list_items(db, paper="GS2")

    assert len(by_month) == 1
    assert len(by_node) == 1
    assert len(by_paper) == 1


async def test_months_are_built_from_the_data(db, node):
    await ca_service.create_item(db, captured(date="2026-08-15"))
    await ca_service.create_item(db, captured(date="2026-09-02", node_id=node))

    rows = await ca_service.months(db)

    assert [row["month"] for row in rows] == ["2026-09", "2026-08"]
    assert rows[0]["untagged"] == 0
    assert rows[1]["untagged"] == 1


async def test_paging_does_not_drop_items_captured_on_one_morning(db):
    for index in range(5):
        await ca_service.create_item(db, captured(headline=f"Item {index}"))

    first, cursor = await ca_service.list_items(db, limit=2)
    second, _ = await ca_service.list_items(db, limit=3, cursor=cursor)

    seen = [doc["headline"] for doc in first + second]
    assert seen == [f"Item {index}" for index in reversed(range(5))]


async def test_delete_takes_the_log_with_it(db, node):
    item = await ca_service.create_item(db, captured(node_id=node))

    await ca_service.delete_item(db, str(item["_id"]))

    assert await db.logs.count_documents({"type": "ca"}) == 0
    with pytest.raises(ca_service.CaError):
        await ca_service.get_item(db, str(item["_id"]))
