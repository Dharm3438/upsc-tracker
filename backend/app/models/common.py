"""Shared model plumbing: ObjectId handling and the subject enum."""

from dataclasses import dataclass
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


class Subject(StrEnum):
    """One row of the syllabus rail. Prelims first, then Mains, in study order."""

    ANCIENT_MEDIEVAL = "ANCIENT_MEDIEVAL"
    MODERN_HISTORY = "MODERN_HISTORY"
    GEOGRAPHY = "GEOGRAPHY"
    ECONOMICS = "ECONOMICS"
    POLITY = "POLITY"
    SCIENCE = "SCIENCE"
    CSAT = "CSAT"
    DISASTER_MGMT = "DISASTER_MGMT"
    IR = "IR"
    SECURITY = "SECURITY"
    WORLD_HISTORY = "WORLD_HISTORY"
    ETHICS = "ETHICS"
    ANTHROPOLOGY = "ANTHROPOLOGY"


class Stage(StrEnum):
    """Prelims or Mains. Presentation only — it groups the chips, nothing more."""

    PRELIMS = "PRELIMS"
    MAINS = "MAINS"


class SourceKind(StrEnum):
    LECTURES = "lectures"
    BOOK = "book"


@dataclass(frozen=True)
class SubjectMeta:
    """What a subject is made of, so the UI can say so without a second source.

    `source_name` is the book a BOOK subject follows, and is empty for a
    lecture series, where the topic count is the only thing worth saying.
    """

    label: str
    stage: Stage
    source_kind: SourceKind
    source_name: str = ""


SUBJECT_META: dict[Subject, SubjectMeta] = {
    Subject.ANCIENT_MEDIEVAL: SubjectMeta(
        "Ancient & Medieval History", Stage.PRELIMS, SourceKind.LECTURES
    ),
    Subject.MODERN_HISTORY: SubjectMeta(
        "Modern History", Stage.PRELIMS, SourceKind.BOOK, "Spectrum"
    ),
    Subject.GEOGRAPHY: SubjectMeta("Geography", Stage.PRELIMS, SourceKind.LECTURES),
    Subject.ECONOMICS: SubjectMeta(
        "Economics", Stage.PRELIMS, SourceKind.BOOK, "Nitin Singhania"
    ),
    Subject.POLITY: SubjectMeta("Polity & Governance", Stage.PRELIMS, SourceKind.LECTURES),
    Subject.SCIENCE: SubjectMeta("Science", Stage.PRELIMS, SourceKind.LECTURES),
    Subject.CSAT: SubjectMeta("CSAT", Stage.PRELIMS, SourceKind.BOOK, "Arihant"),
    Subject.DISASTER_MGMT: SubjectMeta(
        "Disaster Management", Stage.MAINS, SourceKind.LECTURES
    ),
    Subject.IR: SubjectMeta("International Relations", Stage.MAINS, SourceKind.LECTURES),
    Subject.SECURITY: SubjectMeta("Security", Stage.MAINS, SourceKind.LECTURES),
    Subject.WORLD_HISTORY: SubjectMeta("World History", Stage.MAINS, SourceKind.LECTURES),
    Subject.ETHICS: SubjectMeta("Ethics", Stage.MAINS, SourceKind.LECTURES),
    Subject.ANTHROPOLOGY: SubjectMeta("Anthropology", Stage.MAINS, SourceKind.LECTURES),
}

SUBJECT_LABELS: dict[Subject, str] = {s: m.label for s, m in SUBJECT_META.items()}


class PyqWeight(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"
