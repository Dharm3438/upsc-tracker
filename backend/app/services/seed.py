"""Syllabus seeding.

The seed lives in `data/syllabus/<subject>.json`, one file per subject, so a diff
stays reviewable. Each file is:

    {"subject": "POLITY", "topics": [{"title": ..., "pyq_weight": ...}, ...]}

The seed is one flat level of topics per subject — a lecture, or a chapter of
the book the subject follows. A topic may still carry `children` and the loader
nests them up to three deep, but nothing shipped uses that; it is there so a
hand-written addition is not blocked by the loader.

Every node gets a `seed_key`: the slugified chain of its *seed* titles, e.g.
`chapter-7-the-revolt-of-1857`. The seeder
upserts on `(subject, seed_key)`, which is what makes it safe to re-run after the
user has renamed nodes in the app — the key is derived from the file, never
from the (possibly edited) stored title.

The seeder is additive: it inserts nodes it has not seen before and leaves every
existing document alone, including anything with `is_custom: true`.
"""

import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import Subject

SEED_DIR = Path(__file__).resolve().parents[2] / "data" / "syllabus"


def slugify(title: str) -> str:
    normalised = unicodedata.normalize("NFKD", title)
    ascii_only = normalised.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return slug or "node"


@dataclass
class FlatNode:
    subject: str
    title: str
    level: int
    order: int
    seed_key: str
    path: str
    pyq_weight: str
    needs_diagram: bool
    parent_key: str | None


@dataclass
class SeedReport:
    inserted: int = 0
    skipped: int = 0
    per_subject: dict[str, int] = field(default_factory=dict)

    def __str__(self) -> str:
        lines = [f"{p}: {n} nodes" for p, n in sorted(self.per_subject.items())]
        return "\n".join([*lines, f"inserted {self.inserted}, already present {self.skipped}"])


def _flatten(
    subject: str,
    nodes: list[dict],
    level: int,
    parent_key: str | None,
    parent_path: str,
    out: list[FlatNode],
) -> None:
    for order, raw in enumerate(nodes):
        title = raw["title"].strip()
        key = f"{parent_key}/{slugify(title)}" if parent_key else slugify(title)
        path = f"{parent_path}/{title}" if parent_path else f"{subject}/{title}"
        out.append(
            FlatNode(
                subject=subject,
                title=title,
                level=level,
                order=order,
                seed_key=key,
                path=path,
                pyq_weight=raw.get("pyq_weight", "medium"),
                needs_diagram=bool(raw.get("needs_diagram", False)),
                parent_key=parent_key,
            )
        )
        children = raw.get("children") or []
        if children:
            if level == 3:
                raise ValueError(f"{subject}: '{title}' nests deeper than 3 levels")
            _flatten(subject, children, level + 1, key, path, out)


def load_seed(seed_dir: Path = SEED_DIR) -> list[FlatNode]:
    """Read every subject file and flatten it. Raises on malformed content."""
    flat: list[FlatNode] = []
    files = sorted(seed_dir.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"no syllabus seed files in {seed_dir}")
    for file in files:
        doc = json.loads(file.read_text(encoding="utf-8"))
        subject = doc["subject"]
        if subject not in Subject.__members__:
            raise ValueError(f"{file.name}: unknown subject {subject!r}")
        _flatten(subject, doc["topics"], 1, None, "", flat)

    seen: set[tuple[str, str]] = set()
    for node in flat:
        ident = (node.subject, node.seed_key)
        if ident in seen:
            raise ValueError(f"duplicate seed_key {node.seed_key!r} in {node.subject}")
        seen.add(ident)
    return flat


async def seed_syllabus(
    db: AsyncIOMotorDatabase, seed_dir: Path = SEED_DIR
) -> SeedReport:
    """Insert any seed node not already present. Never updates, never deletes."""
    flat = load_seed(seed_dir)
    report = SeedReport()

    existing = {
        (doc["subject"], doc["seed_key"]): doc["_id"]
        async for doc in db.syllabus_nodes.find(
            {"seed_key": {"$ne": None}}, {"subject": 1, "seed_key": 1}
        )
    }

    now = datetime.now(UTC)
    ids: dict[tuple[str, str], object] = dict(existing)

    # Ordered by level, so a parent always has an _id before its children.
    for node in sorted(flat, key=lambda n: n.level):
        ident = (node.subject, node.seed_key)
        report.per_subject[node.subject] = report.per_subject.get(node.subject, 0) + 1
        if ident in ids:
            report.skipped += 1
            continue
        parent_id = ids.get((node.subject, node.parent_key)) if node.parent_key else None
        result = await db.syllabus_nodes.insert_one(
            {
                "subject": node.subject,
                "parent_id": parent_id,
                "title": node.title,
                "level": node.level,
                "order": node.order,
                "path": node.path,
                "seed_key": node.seed_key,
                "pyq_weight": node.pyq_weight,
                "needs_diagram": node.needs_diagram,
                "is_custom": False,
                "is_archived": False,
                "notes": "",
                "gs_linkage": [],
                "created_at": now,
                "updated_at": now,
            }
        )
        ids[ident] = result.inserted_id
        report.inserted += 1

    return report
