"""Study days.

Every date that means "a study day" is a YYYY-MM-DD string in IST, never a
timestamp. Logging at 11:45pm has to land on today, not tomorrow, and that is
only true if the conversion to a calendar day is explicit about Asia/Kolkata.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

DAY = "%Y-%m-%d"


def today_ist(now: datetime | None = None) -> str:
    """The current study day."""
    moment = now or datetime.now(IST)
    return moment.astimezone(IST).strftime(DAY)


def parse_day(day: str) -> date:
    return datetime.strptime(day, DAY).date()


def shift_day(day: str, days: int) -> str:
    """Move a study day by whole days, staying in the string form."""
    return (parse_day(day) + timedelta(days=days)).strftime(DAY)


def days_between(start: str, end: str) -> int:
    """Whole days from `start` to `end`. Negative once `end` is in the past."""
    return (parse_day(end) - parse_day(start)).days
