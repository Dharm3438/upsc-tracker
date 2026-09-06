"""The week's to-do list.

Free text, deliberately. It is a list she writes for herself — "Geography
lecture 4", "revise Polity notes", "buy the new Spectrum" — and nothing here
tries to match it to a syllabus node. The syllabus already knows what has been
read; this is only the list she wants to tick off, and forcing it to line up
with the tree would make writing it a chore instead of a minute's thought.

One list per week, keyed by the Monday it starts on.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.common import PyObjectId

DAY_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class TodoCreate(BaseModel):
    week_start: str | None = Field(default=None, pattern=DAY_PATTERN)
    text: str = Field(min_length=1, max_length=300)

    @field_validator("text")
    @classmethod
    def trim(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("An item needs some text.")
        return trimmed


class TodoUpdate(BaseModel):
    """Rename an item, tick it, or both. Only what is sent is written."""

    text: str | None = Field(default=None, min_length=1, max_length=300)
    done: bool | None = None

    @field_validator("text")
    @classmethod
    def trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("An item needs some text.")
        return trimmed


class Todo(BaseModel):
    id: PyObjectId
    text: str
    done: bool = False


class Week(BaseModel):
    week_start: str
    week_end: str
    #: In the order they were written. A finished item stays where it is
    #: rather than sinking to the bottom — the list is the order she meant.
    todos: list[Todo] = Field(default_factory=list)
    updated_at: datetime | None = None
