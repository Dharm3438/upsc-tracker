"""Unit tests for the scheduler.

No database and no clock: every case is a number that can be checked by hand
against plan §4. These are the tests that matter most in this codebase — a
quietly wrong interval is invisible for weeks and then the revision is gone.
"""

import pytest

from app.services.sm2 import (
    CAP_DEFAULT_DAYS,
    CAP_WEIGHTED_DAYS,
    INITIAL_EASE,
    MIN_EASE,
    ReviewState,
    compression_for,
    first_read,
    schedule,
)

TODAY = "2026-09-02"


def regrade(quality: int, times: int, **kwargs):
    """Grade the same node `times` times, returning every schedule produced."""
    state = None
    results = []
    for _ in range(times):
        result = schedule(state, quality, today=TODAY, **kwargs)
        results.append(result)
        state = ReviewState(
            repetitions=result.repetitions,
            ease_factor=result.ease_factor,
            interval_days=result.interval_days,
            lapses=result.lapses,
        )
    return results


class TestFirstReview:
    def test_starts_at_one_day(self):
        result = schedule(None, 4, today=TODAY)
        assert result.repetitions == 1
        assert result.interval_days == 1
        assert result.next_due == "2026-09-03"
        assert not result.lapsed

    def test_a_read_schedules_tomorrow_without_grading(self):
        result = first_read(TODAY)
        assert result.interval_days == 1
        assert result.next_due == "2026-09-03"
        # Reading is not recall, so it must not move the ease.
        assert result.ease_factor == INITIAL_EASE
        assert result.repetitions == 0


class TestIntervalProgression:
    def test_three_perfect_gradings_give_1_6_16(self):
        """Plan §11 phase 3: intervals of 1, 6, then about 15 days."""
        intervals = [r.interval_days for r in regrade(5, 3)]
        assert intervals == [1, 6, 16]

    def test_ease_rises_on_a_perfect_grade(self):
        first = schedule(None, 5, today=TODAY)
        assert first.ease_factor == pytest.approx(2.6)

    def test_ease_falls_on_a_hard_grade(self):
        # q=3 is a pass, but a costly one: 0.1 - 2*(0.08 + 2*0.02) = -0.14
        result = schedule(None, 3, today=TODAY)
        assert result.ease_factor == pytest.approx(2.36)
        assert not result.lapsed


class TestLapses:
    def test_grade_two_resets_to_tomorrow_and_counts_a_lapse(self):
        """Plan §11 phase 3: grading 2/5 reschedules to tomorrow."""
        state = ReviewState(repetitions=4, ease_factor=2.5, interval_days=30, lapses=0)
        result = schedule(state, 2, today=TODAY)
        assert result.interval_days == 1
        assert result.next_due == "2026-09-03"
        assert result.repetitions == 0
        assert result.lapses == 1
        assert result.lapsed

    def test_lapses_accumulate(self):
        results = regrade(1, 3)
        assert [r.lapses for r in results] == [1, 2, 3]

    def test_ease_never_falls_below_the_floor(self):
        """Repeated failure must not drive the ease to zero."""
        results = regrade(1, 12)
        assert results[-1].ease_factor == MIN_EASE
        assert all(r.ease_factor >= MIN_EASE for r in results)


class TestCaps:
    def test_weighted_topics_cap_at_ninety_days(self):
        state = ReviewState(repetitions=9, ease_factor=2.8, interval_days=200)
        for weight in ("high", "medium"):
            result = schedule(state, 5, today=TODAY, pyq_weight=weight)
            assert result.interval_days == CAP_WEIGHTED_DAYS

    def test_everything_else_caps_at_one_eighty(self):
        state = ReviewState(repetitions=9, ease_factor=2.8, interval_days=400)
        for weight in ("low", "none"):
            result = schedule(state, 5, today=TODAY, pyq_weight=weight)
            assert result.interval_days == CAP_DEFAULT_DAYS

    def test_the_cap_does_not_touch_a_short_interval(self):
        state = ReviewState(repetitions=3, ease_factor=2.5, interval_days=10)
        assert schedule(state, 5, today=TODAY, pyq_weight="high").interval_days == 25


class TestCompression:
    def test_intervals_halve_inside_the_window(self):
        state = ReviewState(repetitions=3, ease_factor=2.5, interval_days=20)
        normal = schedule(state, 5, today=TODAY)
        compressed = schedule(state, 5, today=TODAY, compression_factor=0.5)
        assert normal.interval_days == 50
        assert compressed.interval_days == 25

    def test_compression_never_rounds_below_a_day(self):
        result = schedule(None, 4, today=TODAY, compression_factor=0.1)
        assert result.interval_days == 1

    def test_a_lapse_still_returns_tomorrow(self):
        state = ReviewState(repetitions=3, ease_factor=2.5, interval_days=20)
        assert schedule(state, 1, today=TODAY, compression_factor=0.5).interval_days == 1

    @pytest.mark.parametrize(
        ("days_to_prelims", "expected"),
        [(400, 1.0), (61, 1.0), (60, 1.0), (59, 0.5), (0, 0.5), (-3, 1.0), (None, 1.0)],
    )
    def test_the_window_boundary(self, days_to_prelims, expected):
        assert compression_for(days_to_prelims) == expected


class TestValidation:
    @pytest.mark.parametrize("quality", [0, 6, -1, 10])
    def test_confidence_outside_one_to_five_is_rejected(self, quality):
        with pytest.raises(ValueError, match="confidence must be 1-5"):
            schedule(None, quality, today=TODAY)
