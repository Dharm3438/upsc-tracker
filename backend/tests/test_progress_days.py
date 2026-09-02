"""The date arithmetic behind every pace figure.

No database and no clock: a study day is a string, and whether it counts is a
question about the calendar and her off-days. Every number here can be checked
by hand, which is the point — the burn-down divides by these, so a quietly
wrong count would make the whole screen lie politely.
"""

from app.services import progress as progress_service
from app.services import settings as settings_service

TODAY = "2026-09-02"  # a Wednesday
PRELIMS = "2027-05-30"

# Sunday off. 0 is Monday in Python's numbering, so 6 is Sunday.
SUNDAY = 6


def test_study_day_excludes_the_weekly_off():
    # 2026-09-06 is a Sunday.
    assert progress_service.is_study_day("2026-09-06", [], SUNDAY) is False
    assert progress_service.is_study_day("2026-09-07", [], SUNDAY) is True
    assert progress_service.is_study_day("2026-09-06", [], None) is True


def test_study_day_excludes_a_planned_off_day():
    assert progress_service.is_study_day("2026-09-07", ["2026-09-07"], SUNDAY) is False


def test_effective_days_excludes_today():
    """Today is half spent already; counting it inflates every pace figure."""
    assert progress_service.effective_study_days(TODAY, TODAY) == 0
    assert progress_service.effective_study_days(TODAY, "2026-09-03") == 1


def test_effective_days_is_zero_once_the_exam_is_past():
    assert progress_service.effective_study_days(TODAY, "2026-08-01") == 0


def test_effective_days_removes_sundays_and_off_days():
    """Hand check: 2 September to 30 May is 270 days, of which 39 are Sundays."""
    calendar = progress_service.effective_study_days(TODAY, PRELIMS)
    assert calendar == 270

    sundays_off = progress_service.effective_study_days(TODAY, PRELIMS, [], SUNDAY)
    assert sundays_off == 270 - 39

    # Both off-days are a Tuesday and a Wednesday, so neither double-counts
    # against a Sunday already removed.
    with_breaks = progress_service.effective_study_days(
        TODAY, PRELIMS, ["2026-10-20", "2026-10-21"], SUNDAY
    )
    assert with_breaks == sundays_off - 2


def test_off_day_on_the_weekly_off_is_not_removed_twice():
    """2026-09-06 is a Sunday; naming it as an off-day too changes nothing."""
    plain = progress_service.effective_study_days(TODAY, "2026-09-30", [], SUNDAY)
    doubled = progress_service.effective_study_days(
        TODAY, "2026-09-30", ["2026-09-06"], SUNDAY
    )
    assert plain == doubled


def test_week_start_is_the_monday_on_or_before():
    assert settings_service.week_start_of("2026-09-02") == "2026-08-31"
    assert settings_service.week_start_of("2026-08-31") == "2026-08-31"
    assert settings_service.week_start_of("2026-09-06") == "2026-08-31"
