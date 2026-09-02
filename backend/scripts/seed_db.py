"""Seed the syllabus into MongoDB. Idempotent — safe to re-run.

    python scripts/seed_db.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db import close, connect, ensure_indexes  # noqa: E402
from app.services.seed import seed_syllabus  # noqa: E402


async def main() -> int:
    settings = get_settings()
    if not settings.mongodb_uri:
        print("MONGODB_URI is not set. Copy .env.example to .env and fill it in.")
        return 1
    db = connect()
    await ensure_indexes()
    report = await seed_syllabus(db)
    print(report)
    await close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
