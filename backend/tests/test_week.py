"""The weekly to-do list.

Free text, one list per week, and nothing tied to the syllabus — so the tests
are about the week the list lands in and the four things she can do to it.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.week import TodoCreate, TodoUpdate
from app.services import week as week_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
#: A Wednesday. Its week runs Monday the 31st to Sunday the 6th.
WEDNESDAY = "2026-09-02"
MONDAY = "2026-08-31"
SUNDAY_END = "2026-09-06"
LAST_MONDAY = "2026-08-24"


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


async def add(db, text: str, week_start: str = WEDNESDAY) -> dict:
    return await week_service.add_todo(
        db, TodoCreate(week_start=week_start, text=text)
    )


async def test_an_empty_week_is_an_empty_list_not_an_error(db):
    week = await week_service.get_week(db, start=WEDNESDAY)

    assert week["week_start"] == MONDAY
    assert week["week_end"] == SUNDAY_END
    assert week["todos"] == []


async def test_items_keep_the_order_they_were_written_in(db):
    await add(db, "Geography lecture 4")
    await add(db, "Revise Polity notes")
    week = await add(db, "Spectrum ch. 12")

    assert [item["text"] for item in week["todos"]] == [
        "Geography lecture 4",
        "Revise Polity notes",
        "Spectrum ch. 12",
    ]
    assert all(item["done"] is False for item in week["todos"])


async def test_text_is_trimmed_and_free_of_any_syllabus(db):
    week = await add(db, "  buy the new Spectrum  ")

    assert week["todos"][0]["text"] == "buy the new Spectrum"


async def test_ticking_an_item_leaves_it_where_it_is(db):
    week = await add(db, "Geography lecture 4")
    await add(db, "Revise Polity notes")
    first = week["todos"][0]["id"]

    week = await week_service.update_todo(db, MONDAY, first, TodoUpdate(done=True))

    assert [item["done"] for item in week["todos"]] == [True, False]


async def test_an_item_can_be_reworded(db):
    week = await add(db, "Geograhy lecture 4")
    todo_id = week["todos"][0]["id"]

    week = await week_service.update_todo(
        db, MONDAY, todo_id, TodoUpdate(text="Geography lecture 4")
    )

    assert week["todos"][0]["text"] == "Geography lecture 4"
    assert week["todos"][0]["id"] == todo_id


async def test_deleting_the_same_item_twice_is_not_an_error(db):
    week = await add(db, "Geography lecture 4")
    todo_id = week["todos"][0]["id"]

    await week_service.delete_todo(db, MONDAY, todo_id)
    week = await week_service.delete_todo(db, MONDAY, todo_id)

    assert week["todos"] == []


async def test_editing_an_item_that_is_gone_says_so(db):
    week = await add(db, "Geography lecture 4")
    todo_id = week["todos"][0]["id"]
    await week_service.delete_todo(db, MONDAY, todo_id)

    with pytest.raises(week_service.WeekError):
        await week_service.update_todo(db, MONDAY, todo_id, TodoUpdate(done=True))


async def test_each_week_keeps_its_own_list(db):
    await add(db, "This week's reading")
    await add(db, "Last week's reading", week_start=LAST_MONDAY)

    this_week = await week_service.get_week(db, start=WEDNESDAY)
    last_week = await week_service.get_week(db, start=LAST_MONDAY)

    assert [item["text"] for item in this_week["todos"]] == ["This week's reading"]
    assert [item["text"] for item in last_week["todos"]] == ["Last week's reading"]
