"""A very small in-process TTL cache for the syllabus tree.

The tree is the most expensive read in the app — a subject's worth of nodes plus
two aggregations — and it is re-fetched on every visit to the Syllabus tab. It
is also single-user data on a single web service, so a dict is the right size of
solution; anything shared would need Redis and a second thing to deploy.

Entries expire on their own after `TTL_SECONDS`, and every write that could
change a rollup calls `invalidate()`, so a freshly logged reading shows up
immediately rather than up to a minute later.
"""

import time
from typing import Any

TTL_SECONDS = 60

_entries: dict[str, tuple[float, Any]] = {}


def get(key: str) -> Any | None:
    entry = _entries.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at < time.monotonic():
        _entries.pop(key, None)
        return None
    return value


def put(key: str, value: Any) -> None:
    _entries[key] = (time.monotonic() + TTL_SECONDS, value)


def invalidate() -> None:
    """Drop everything. The cache is small enough that per-key eviction would
    be more bookkeeping than it saves."""
    _entries.clear()
