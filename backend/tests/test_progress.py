"""Progress maths.

The date arithmetic is pure and is tested first, without a database, because
every other figure on the screen divides by it. The aggregations follow, on a
small fixture whose numbers are easy to check by hand â€” which is the phase's
acceptance criterion.
"""

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.models.logs import LogCreate
from app.models.settings import AppSettings, WeeklyReviewCreate
from app.services import logs as log_service
from app.services import nodes as node_service
from app.services import progress as progress_service
from app.services import settings as settings_service

pytestmark = pytest.mark.asyncio(loop_scope="module")

TEST_DB = "upsc_tracker_test"
TODAY = "2026-09-02"  # a Wednesday
PRELIMS = "2027-05-30"

# Sunday off, nothing else. 0 is Monday in Python's numbering, so 6 is Sunday.
SUNDAY = 6


# --------------------------------------------------------------- aggregations


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
    """No weekly off and no off-days, so the fixture arithmetic is calendar
    arithmetic and the deviations are tested on their own above."""
    return AppSettings(prelims_date=PRELIMS, weekly_off_weekday=None, off_days=[])


@pytest_asyncio.fixture
async def leaves(db) -> list[str]:
    """One section with four level-2 topics: four leaves, no deeper nesting."""
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


async def test_burndown_counts_only_leaves_and_only_once(db, leaves, settings):
    """A section is not a unit of progress, and reading a topic twice does not
    make it two topics."""
    await log(db, leaves[0], "read", "2026-08-20", source="Laxmikanth", confidence=3)
    await log(db, leaves[0], "read", "2026-08-27", source="Laxmikanth", confidence=4)
    await log(db, leaves[1], "read", "2026-09-01", source="Laxmikanth", confidence=3)

    result = await progress_service.burndown(db, settings, date=TODAY)

    assert result["total_leaves"] == 4
    assert result["started_leaves"] == 2
    assert result["remaining"] == 2


async def test_burndown_required_pace_is_remaining_over_study_days(
    db, leaves, settings
):
    """Hand calculation: 4 topics left over the 270 study days to Prelims."""
    result = await progress_service.burndown(db, settings, date=TODAY)

    assert result["study_days_remaining"] == 270
    assert result["remaining"] == 4
    assert result["required_per_day"] == round(4 / 270, 3)


async def test_burndown_actual_pace_uses_study_days_not_calendar_days(db, leaves):
    """Two topics opened since the 20th of August, and the fortnight since has
    two Sundays in it: the pace is over the days she meant to study."""
    settings = AppSettings(prelims_date=PRELIMS, weekly_off_weekday=SUNDAY, off_days=[])
    await log(db, leaves[0], "read", "2026-08-20", source="Book", confidence=3)
    await log(db, leaves[1], "read", "2026-09-01", source="Book", confidence=3)

    result = await progress_service.burndown(db, settings, date=TODAY)

    # The window starts at her first log rather than 28 days back.
    assert result["actual_window_days"] == 14
    # 14 days from 20 August to 2 September, of which the 23rd and 30th are
    # Sundays, leaves 12 study days for 2 topics.
    assert result["actual_per_day"] == round(2 / 12, 3)


async def test_burndown_series_starts_at_the_first_log_and_ends_at_prelims(
    db, leaves, settings
):
    await log(db, leaves[0], "read", "2026-08-20", source="Book", confidence=3)

    series = (await progress_service.burndown(db, settings, date=TODAY))["series"]

    assert series[0]["date"] == "2026-08-20"
    assert series[-1]["date"] == PRELIMS
    # The required line reaches zero on exam day and starts at everything left.
    assert series[-1]["required"] == 0
    # Both lines start from the same point — three left after that first day.
    assert series[0]["required"] == pytest.approx(3, abs=0.01)
    # Nothing is claimed about the future, and today is the last real point.
    past = [point for point in series if point["remaining"] is not None]
    assert past[-1]["date"] == TODAY
    assert past[-1]["remaining"] == 3
    assert all(point["remaining"] is None for point in series if point["date"] > TODAY)


async def test_coverage_counts_read_revised_twice_and_tested(db, leaves, settings):
    """Revised means twice â€” once is reading it again."""
    await log(db, leaves[0], "read", "2026-08-20", source="Book", confidence=3)
    await log(db, leaves[0], "revise", "2026-08-25", confidence=4, method="recall")
    await log(db, leaves[0], "revise", "2026-08-30", confidence=4, method="recall")
    await log(db, leaves[1], "read", "2026-08-21", source="Book", confidence=3)
    await log(db, leaves[1], "revise", "2026-08-26", confidence=3, method="notes")
    await log(db, leaves[2], "mcq", "2026-08-28", attempted=10, correct=6, skipped=0)

    result = await progress_service.coverage(db, date=TODAY)
    gs2 = next(row for row in result["subjects"] if row["subject"] == "POLITY")

    assert gs2["leaves"] == 4
    assert gs2["read"] == 2
    assert gs2["revised"] == 1
    assert gs2["tested"] == 1
    assert result["totals"]["read"] == 2


async def test_heatmap_carries_confidence_and_leaves_untouched_squares_empty(
    db, leaves, settings
):
    await log(db, leaves[0], "read", "2026-08-20", source="Book", confidence=3)
    await log(db, leaves[0], "revise", "2026-08-25", confidence=5, method="recall")

    result = await progress_service.heatmap(db, subject="POLITY", date=TODAY)
    cells = {cell["title"]: cell for cell in result["sections"][0]["cells"]}

    assert result["sections"][0]["section"] == "Polity"
    assert len(cells) == 4
    assert cells["Federalism"]["confidence"] == 5
    assert cells["Federalism"]["started"] is True
    assert cells["Judiciary"]["confidence"] is None
    assert cells["Judiciary"]["started"] is False


async def test_effort_marks_off_days_rather_than_zeroing_them(db, leaves):
    settings = AppSettings(
        prelims_date=PRELIMS, weekly_off_weekday=SUNDAY, off_days=["2026-09-01"]
    )
    await log(db, leaves[0], "read", TODAY, minutes=45, source="Book", confidence=3)
    await log(db, leaves[1], "read", TODAY, minutes=30, source="Book", confidence=3)

    result = await progress_service.effort(db, settings, days=7, date=TODAY)
    days = {row["date"]: row for row in result["days"]}

    assert len(result["days"]) == 7
    assert days[TODAY]["minutes"] == 75
    assert days[TODAY]["logs"] == 2
    assert days["2026-08-30"]["off"] is True  # a Sunday
    assert days["2026-09-01"]["off"] is True  # the planned break
    assert days["2026-08-31"]["off"] is False
    # Five study days in the window, 75 minutes on one of them.
    assert result["study_days"] == 5
    assert result["average_minutes"] == 15


async def test_countdown_reports_both_exams(db, settings):
    result = await progress_service.countdown(db, settings, date=TODAY)

    assert result["prelims"]["days"] == 270
    assert result["prelims"]["study_days"] == 270
    assert result["mains"]["date"] == settings.mains_date
    assert result["mains"]["days"] > result["prelims"]["days"]


# ------------------------------------------------------------------ settings


async def test_settings_read_before_anything_is_saved_returns_defaults(db):
    stored = await settings_service.get_settings(db)

    assert stored.prelims_date == AppSettings().prelims_date
    assert await db.app_settings.count_documents({}) == 0


async def test_settings_patch_writes_only_what_was_sent(db):
    from app.models.settings import SettingsUpdate

    await settings_service.update_settings(db, SettingsUpdate(off_days=["2026-10-20"]))
    stored = await settings_service.update_settings(
        db, SettingsUpdate(prelims_date="2027-06-06")
    )

    assert stored.prelims_date == "2027-06-06"
    assert stored.off_days == ["2026-10-20"]


async def test_settings_patch_accepts_no_weekly_off(db):
    from app.models.settings import SettingsUpdate

    stored = await settings_service.update_settings(
        db, SettingsUpdate(weekly_off_weekday=None)
    )

    assert stored.weekly_off_weekday is None


async def test_weekly_review_snapshots_the_week_and_keeps_it_on_a_rewrite(
    db, leaves
):
    await log(db, leaves[0], "read", "2026-09-01", source="Book", confidence=3)
    await log(db, leaves[1], "read", "2026-09-01", source="Book", confidence=3)
    await log(db, leaves[0], "revise", "2026-09-02", confidence=4, method="recall")

    first = await settings_service.create_weekly_review(
        db, WeeklyReviewCreate(week_start=TODAY, what_slipped="Geography")
    )

    assert first["week_start"] == "2026-08-31"
    assert first["nodes_covered"] == 2
    assert first["nodes_revised"] == 1

    # A third topic read after the review is written must not rewrite history.
    await log(db, leaves[2], "read", "2026-09-02", source="Book", confidence=3)
    again = await settings_service.create_weekly_review(
        db, WeeklyReviewCreate(week_start=TODAY, what_slipped="Geography and maps")
    )

    assert again["_id"] == first["_id"]
    assert again["what_slipped"] == "Geography and maps"
    assert again["nodes_covered"] == 2
