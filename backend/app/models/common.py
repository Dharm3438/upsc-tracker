"""Shared model plumbing: ObjectId handling and the paper enum."""

from enum import StrEnum
from typing import Annotated, Any

from bson import ObjectId
from pydantic import BeforeValidator


def _to_str_id(v: Any) -> Any:
    """Accept an ObjectId or its string form; models always carry the string."""
    if v is None or isinstance(v, str):
        if isinstance(v, str) and not ObjectId.is_valid(v):
            raise ValueError(f"invalid ObjectId: {v!r}")
        return v
    if isinstance(v, ObjectId):
        return str(v)
    raise ValueError(f"invalid ObjectId: {v!r}")


PyObjectId = Annotated[str, BeforeValidator(_to_str_id)]


class Paper(StrEnum):
    GS1 = "GS1"
    GS2 = "GS2"
    GS3 = "GS3"
    GS4 = "GS4"
    CSAT = "CSAT"
    ESSAY = "ESSAY"
    ANTHRO1 = "ANTHRO1"
    ANTHRO2 = "ANTHRO2"


PAPER_LABELS: dict[Paper, str] = {
    Paper.GS1: "GS 1",
    Paper.GS2: "GS 2",
    Paper.GS3: "GS 3",
    Paper.GS4: "GS 4",
    Paper.CSAT: "CSAT",
    Paper.ESSAY: "Essay",
    Paper.ANTHRO1: "Anthro I",
    Paper.ANTHRO2: "Anthro II",
}


class PyqWeight(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"
