"""The weekly tracker.

The plan is stored and the week's numbers are not, so the tests are mostly
about the counting: what a new topic is, when a committed topic ticks itself,
and that the week is the Monday-to-Sunday one the review already uses.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.logs import LogCreate
from app.models.settings import AppSettings
from app.models.week import WeekPlanUpdate, WeekTargets
from app.services import logs as log_service
from app.services import nodes as node_service
from app.services import week as week_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
#: A Wednesday. Its week runs Monday the 31st to Sunday the 6th.
TODAY = "2026-09-02"
MONDAY = "2026-08-31"
SUNDAY_END = "2026-09-06"
PRELIMS = "2027-05-30"


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


@pytest.fixture
def settings() -> AppSettings:
    """No weekly off, so a week is seven study days and the suggestion is
    plain multiplication."""
    return AppSettings(prelims_date=PRELIMS, weekly_off_weekday=None, off_days=[])


@pytest_asyncio.fixture
async def leaves(db) -> list[str]:
    section = await node_service.create_node(
        db, subject="POLITY", title="Polity", parent_id=None, pyq_weight="high"
    )
    titles = ["Federalism", "Emergency", "Judiciary", "Panchayats"]
    return [
        str(
            (
                await node_service.create_node(
                    db, subject="POLITY", title=title, parent_id=str(section["_id"])
                )
            )["_id"]
        )
        for title in titles
    ]


async def log(db, node_id: str, kind: str, date: str, **payload) -> None:
    minutes = payload.pop("minutes", None)
    await log_service.create_log(
        db,
        LogCreate(node_id=node_id, type=kind, date=date, minutes=minutes, payload=payload),
    )


async def test_week_rounds_any_day_back_to_its_monday(db, settings):
    week = await week_service.get_week(db, settings, start="2026-09-04", date=TODAY)

    assert week["week_start"] == MONDAY
    assert week["week_end"] == SUNDAY_END


async def test_new_topics_counts_first_touches_inside_the_week(db, leaves, settings):
    """A topic opened in August is not new in September, and re-reading it does
    not make it new again."""
    await log(db, leaves[0], "read", "2026-08-20", source="Book", confidence=3)
    await log(db, leaves[0], "read", "2026-09-01", source="Book", confidence=4)
    await log(db, leaves[1], "read", "2026-09-01", source="Book", confidence=3)

    week = await week_service.get_week(db, settings, date=TODAY)

    assert week["actuals"]["new_topics"] == 1


async def test_actuals_sum_minutes_mcqs_and_answers_in_the_week(db, leaves, settings):
    await log(db, leaves[0], "read", "2026-09-01", minutes=90, source="Book", confidence=3)
    await log(db, leaves[1], "mcq", "2026-09-02", minutes=30, attempted=25, correct=18)
    # Outside the week, so neither figure moves.
    await log(db, leaves[2], "read", "2026-08-25", minutes=60, source="Book", confidence=3)

    actuals = (await week_service.get_week(db, settings, date=TODAY))["actuals"]

    assert actuals["study_minutes"] == 120
    assert actuals["mcqs"] == 25


async def test_commitments_tick_themselves_when_the_topic_is_logged(
    db, leaves, settings
):
    """Nothing on the list is checked by hand: a reading inside the week is
    what marks a topic done."""
    await week_service.save_plan(
        db,
        settings,
        WeekPlanUpdate(week_start=TODAY, commitments=[leaves[0], leaves[1]]),
    )
    await log(db, leaves[0], "read", "2026-09-01", source="Book", confidence=3)
    # Last week's reading does not count towards this week's commitment.
    await log(db, leaves[1], "read", "2026-08-25", source="Book", confidence=3)

    commitments = (await week_service.get_week(db, settings, date=TODAY))["commitments"]

    assert [item["done"] for item in commitments] == [True, False]
    assert commitments[0]["title"] == "Federalism"


async def test_saving_the_plan_twice_replaces_it(db, leaves, settings):
    await week_service.save_plan(
        db,
        settings,
        WeekPlanUpdate(
            week_start=TODAY,
            targets=WeekTargets(new_topics=8),
            commitments=[leaves[0]],
        ),
    )
    week = await week_service.save_plan(
        db,
        settings,
        WeekPlanUpdate(
            week_start=TODAY,
            targets=WeekTargets(new_topics=5, answers=10),
            commitments=[leaves[1], leaves[1]],
        ),
    )

    assert week["targets"]["new_topics"] == 5
    assert week["targets"]["answers"] == 10
    # Duplicates are a double tap, not a plan to read the same topic twice.
    assert [item["node_id"] for item in week["commitments"]] == [leaves[1]]


async def test_suggestion_scales_the_required_pace_to_the_week(db, leaves, settings):
    """Four topics left over the 270 study days to Prelims, across a
    seven-study-day week."""
    week = await week_service.get_week(db, settings, date=TODAY)

    assert week["study_days"] == 7
    assert week["suggested"]["new_topics"] == round(4 / 270 * 7)
    assert week["suggested"]["study_minutes"] == 420 * 7
