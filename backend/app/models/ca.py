"""Current affairs.

The whole design of this collection follows from one fact: a current-affairs
item is captured in a hurry, from a newspaper, and tagged to the syllabus
later. So capture asks for two fields — a headline and a line in her own words
— and everything else, including the topic, is optional and can arrive days
afterwards.

`tagged` is not a field a client sets. It is the answer to "does this have a
node", derived on every write, because an item that says it is tagged while
carrying no node would quietly rot the inbox.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.dates import today_ist
from app.models.common import Paper, PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
MONTH_PATTERN = r"^\d{4}-\d{2}$"


class CaBase(BaseModel):
    #: The event, in a few words. The only required field.
    headline: str = Field(min_length=1, max_length=300)
    source: str = Field(default="", max_length=120)
    #: One or two lines in her words. Copying the article defeats the purpose,
    #: so the cap is deliberately short.
    note: str = Field(default="", max_length=1000)
    starred: bool = False

    @field_validator("headline", "source", "note")
    @classmethod
    def trim(cls, value: str) -> str:
        return value.strip()


class CaCreate(CaBase):
    date: str = Field(default_factory=today_ist, pattern=DAY_PATTERN)
    #: Optional at capture: most items are tagged later, from the inbox.
    node_id: PyObjectId | None = None


class CaUpdate(BaseModel):
    """Every field optional.

    `node_id` is the one that matters: sending a node tags the item and sending
    an explicit null untags it back into the inbox. Both are distinguishable
    from "not mentioned" because the service reads only the fields that were
    actually set.
    """

    date: str | None = Field(default=None, pattern=DAY_PATTERN)
    headline: str | None = Field(default=None, min_length=1, max_length=300)
    source: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)
    node_id: PyObjectId | None = None
    starred: bool | None = None

    @field_validator("headline", "source", "note")
    @classmethod
    def trim(cls, value: str | None) -> str | None:
        return None if value is None else value.strip()


class CaItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(alias="_id")
    date: str
    #: Derived from the date. Magazine revision is monthly, so the month is
    #: stored rather than computed on read — it is what the list groups and
    #: filters on, and an indexed field cannot be a string slice.
    month: str
    headline: str
    source: str = ""
    note: str = ""
    node_id: PyObjectId | None = None
    #: Denormalised from the node, as a mistake's is, so the paper filter never
    #: joins the syllabus. Null while the item is untagged.
    paper: Paper | None = None
    tagged: bool = False
    starred: bool = False
    created_at: datetime | None = None
    #: Joined on read, so a renamed topic reads correctly everywhere.
    node_title: str | None = None
    node_path: str | None = None


class CaPage(BaseModel):
    items: list[CaItem]
    next_cursor: str | None = None


class CaMonth(BaseModel):
    """A month that has items in it, for the month filter."""

    month: str
    count: int
    untagged: int


def month_of(day: str) -> str:
    """The month a study day falls in. Dates are IST strings, so this is a
    slice rather than a timezone conversion."""
    return day[:7]
