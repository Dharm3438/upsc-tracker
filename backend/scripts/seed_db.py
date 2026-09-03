"""Seed the syllabus into MongoDB. Idempotent — safe to re-run.

    python scripts/seed_db.py

The seeder only ever inserts, so it cannot clear out a syllabus that was seeded
under a different set of subjects. When the subject list itself changes, start
over:

    python scripts/seed_db.py --reset

That drops the syllabus and everything logged against it — every node id in
`logs`, `review_state`, `mistakes`, `answers` and `ca_items` would otherwise
point at a topic that no longer exists. It asks before it does it.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db import close, connect, ensure_indexes  # noqa: E402
from app.services.seed import seed_syllabus  # noqa: E402

#: Everything keyed to a syllabus node. Dropped together or not at all — a
#: half-cleared database is worse than either end of the choice.
RESET_COLLECTIONS = [
    "syllabus_nodes",
    "logs",
    "review_state",
    "mistakes",
    "answers",
    "ca_items",
    "tests",
    "weekly_reviews",
]


async def _reset(db) -> None:
    counts = {name: await db[name].count_documents({}) for name in RESET_COLLECTIONS}
    total = sum(counts.values())
    print(f"About to drop {total} documents from {get_settings().mongodb_db}:")
    for name, n in counts.items():
        print(f"  {name}: {n}")
    if input("Type 'reset' to confirm: ").strip() != "reset":
        print("Left alone.")
        raise SystemExit(1)
    for name in RESET_COLLECTIONS:
        await db[name].drop()
    print("Dropped. Re-seeding.")


async def main() -> int:
    settings = get_settings()
    if not settings.mongodb_uri:
        print("MONGODB_URI is not set. Copy .env.example to .env and fill it in.")
        return 1
    db = connect()
    if "--reset" in sys.argv:
        await _reset(db)
    await ensure_indexes()
    report = await seed_syllabus(db)
    print(report)
    await close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
