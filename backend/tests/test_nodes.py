"""Integration tests for the tree writes.

These need a real Mongo because the whole point is the repath behaviour, which
lives in the queries. They run against a database whose name ends in `_test`
and drop it afterwards; without MONGODB_URI set they skip.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.services import nodes as node_service
from app.services.nodes import NodeError

# Every test in this file shares the module-scoped client, so it must also
# share that client's event loop.
pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"


@pytest_asyncio.fixture(scope="module")
async def client():
    """One client for the module. A client per test means an SRV lookup per
    test, which Atlas starts refusing."""
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


async def seed_branch(db) -> dict[str, str]:
    """A small GS2 branch: section → topic → two leaves."""
    section = await node_service.create_node(
        db, paper="GS2", title="Polity", parent_id=None
    )
    topic = await node_service.create_node(
        db, paper="GS2", title="Federalism", parent_id=str(section["_id"])
    )
    leaf_a = await node_service.create_node(
        db, paper="GS2", title="Centre-State relations", parent_id=str(topic["_id"])
    )
    leaf_b = await node_service.create_node(
        db, paper="GS2", title="Inter-State Council", parent_id=str(topic["_id"])
    )
    return {
        "section": str(section["_id"]),
        "topic": str(topic["_id"]),
        "leaf_a": str(leaf_a["_id"]),
        "leaf_b": str(leaf_b["_id"]),
    }


async def path_of(db, node_id: str) -> str:
    from bson import ObjectId

    doc = await db.syllabus_nodes.find_one({"_id": ObjectId(node_id)})
    return doc["path"]


async def test_create_derives_level_order_and_path(db):
    ids = await seed_branch(db)
    assert await path_of(db, ids["topic"]) == "GS2/Polity/Federalism"
    assert await path_of(db, ids["leaf_b"]) == "GS2/Polity/Federalism/Inter-State Council"

    from bson import ObjectId

    leaf_b = await db.syllabus_nodes.find_one({"_id": ObjectId(ids["leaf_b"])})
    assert leaf_b["level"] == 3
    assert leaf_b["order"] == 1  # second child
    assert leaf_b["is_custom"] is True
    assert leaf_b["seed_key"] is None


async def test_create_refuses_a_fourth_level(db):
    ids = await seed_branch(db)
    with pytest.raises(NodeError, match="only 3 levels"):
        await node_service.create_node(
            db, paper="GS2", title="Too deep", parent_id=ids["leaf_a"]
        )


async def test_create_refuses_a_duplicate_sibling(db):
    ids = await seed_branch(db)
    with pytest.raises(NodeError, match="already exists"):
        await node_service.create_node(
            db, paper="GS2", title="Inter-State Council", parent_id=ids["topic"]
        )


async def test_renaming_a_level_two_node_repaths_every_descendant(db):
    ids = await seed_branch(db)

    await node_service.update_node(db, ids["topic"], {"title": "Federal structure"})

    assert await path_of(db, ids["topic"]) == "GS2/Polity/Federal structure"
    assert (
        await path_of(db, ids["leaf_a"])
        == "GS2/Polity/Federal structure/Centre-State relations"
    )
    assert (
        await path_of(db, ids["leaf_b"])
        == "GS2/Polity/Federal structure/Inter-State Council"
    )


async def test_renaming_a_section_repaths_two_levels_down(db):
    ids = await seed_branch(db)

    await node_service.update_node(db, ids["section"], {"title": "Polity and governance"})

    assert (
        await path_of(db, ids["leaf_a"])
        == "GS2/Polity and governance/Federalism/Centre-State relations"
    )


async def test_rename_does_not_touch_a_similarly_named_sibling(db):
    """The prefix match must not treat 'Polity' as a prefix of 'Polity notes'."""
    ids = await seed_branch(db)
    sibling = await node_service.create_node(
        db, paper="GS2", title="Polity notes", parent_id=None
    )

    await node_service.update_node(db, ids["section"], {"title": "Constitution"})

    assert await path_of(db, str(sibling["_id"])) == "GS2/Polity notes"


async def test_moving_a_topic_carries_its_subtree(db):
    ids = await seed_branch(db)
    other = await node_service.create_node(
        db, paper="GS2", title="Governance", parent_id=None
    )

    await node_service.move_node(db, ids["topic"], str(other["_id"]), None)

    assert await path_of(db, ids["topic"]) == "GS2/Governance/Federalism"
    assert (
        await path_of(db, ids["leaf_a"])
        == "GS2/Governance/Federalism/Centre-State relations"
    )


async def test_a_move_cannot_push_the_tree_past_three_levels(db):
    ids = await seed_branch(db)
    # A leaf outside the moving node's own subtree, so the depth check is what
    # rejects the move rather than the cycle check.
    other = await node_service.create_node(
        db, paper="GS2", title="Governance", parent_id=None
    )
    other_topic = await node_service.create_node(
        db, paper="GS2", title="Transparency", parent_id=str(other["_id"])
    )

    with pytest.raises(NodeError, match="past 3 levels"):
        await node_service.move_node(db, ids["topic"], str(other_topic["_id"]), None)


async def test_a_node_cannot_move_into_its_own_subtree(db):
    ids = await seed_branch(db)
    with pytest.raises(NodeError, match="own subtree"):
        await node_service.move_node(db, ids["section"], ids["topic"], None)


async def test_archive_is_refused_while_children_are_live(db):
    ids = await seed_branch(db)
    with pytest.raises(NodeError, match="its 2 children first"):
        await node_service.archive_node(db, ids["topic"])


async def test_the_refusal_counts_one_child_in_the_singular(db):
    ids = await seed_branch(db)
    await node_service.archive_node(db, ids["leaf_b"])
    with pytest.raises(NodeError, match="its 1 child first"):
        await node_service.archive_node(db, ids["topic"])


async def test_archive_allowed_once_children_are_archived(db):
    ids = await seed_branch(db)
    await node_service.archive_node(db, ids["leaf_a"])
    await node_service.archive_node(db, ids["leaf_b"])

    archived = await node_service.archive_node(db, ids["topic"])
    assert archived["is_archived"] is True


async def test_titles_cannot_smuggle_a_path_separator(db):
    node = await node_service.create_node(
        db, paper="GS2", title="Rights / Duties", parent_id=None
    )
    assert node["path"] == "GS2/Rights Duties"
    assert "/" not in node["title"]


async def test_a_custom_node_survives_a_re_run_of_the_seed(db):
    """Phase 1 acceptance: seeding is additive and never touches custom nodes."""
    from app.services.seed import seed_syllabus

    await seed_syllabus(db)
    custom = await node_service.create_node(
        db, paper="GS2", title="My own revision list", parent_id=None
    )
    before = await db.syllabus_nodes.count_documents({})

    report = await seed_syllabus(db)

    from bson import ObjectId

    still_there = await db.syllabus_nodes.find_one({"_id": ObjectId(custom["_id"])})
    assert still_there is not None
    assert still_there["title"] == "My own revision list"
    assert report.inserted == 0
    assert await db.syllabus_nodes.count_documents({}) == before
