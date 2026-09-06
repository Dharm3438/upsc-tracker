"""Drop the per-article current-affairs data. One-off, after the feature's removal.

    python scripts/drop_current_affairs.py

Current affairs is now a syllabus subject read one monthly magazine at a time,
so the `ca_items` collection and the `type: "ca"` activity logs it wrote onto
node timelines have nothing left to render them. Neither is read by any code
path any more; this only stops them taking up room and confusing a later reader.

Nothing else is touched — the syllabus, reading logs, revisions, tests, mistakes
and answers are all left exactly as they are. It asks before it deletes.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db import close, connect  # noqa: E402


async def main() -> int:
    settings = get_settings()
    if not settings.mongodb_uri:
        print("MONGODB_URI is not set. Copy .env.example to .env and fill it in.")
        return 1

    db = connect()
    items = await db.ca_items.count_documents({})
    logs = await db.logs.count_documents({"type": "ca"})

    if items == 0 and logs == 0:
        print("Nothing to drop — no current-affairs data in this database.")
        await close()
        return 0

    print(f"About to delete from {settings.mongodb_db}:")
    print(f"  ca_items: {items} documents (the whole collection)")
    print(f"  logs:     {logs} current-affairs entries")
    if input("Type 'drop' to confirm: ").strip() != "drop":
        print("Left alone.")
        await close()
        return 1

    await db.ca_items.drop()
    result = await db.logs.delete_many({"type": "ca"})
    print(f"Dropped ca_items and deleted {result.deleted_count} log entries.")
    await close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
