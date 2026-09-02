"""The revision queue: what SM-2 says should come back, and when.

`services/sm2.py` decides when a topic returns; this decides what she sees when
it does. Both queries start from `review_state` — which only ever has a document
per node that has been read — so the queue is proportional to what she has
actually studied, not to the size of the syllabus.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dates import days_between, shift_day, today_ist

DEFAULT_DUE_LIMIT = 50
DEFAULT_FORECAST_DAYS = 7

#: Past this, a topic is not merely late, and the row earns the one warm tone
#: the palette allows (plan §10).
OVERDUE_ATTENTION_DAYS = 14

#: pyq_weight is an enum, and Mongo would sort it alphabetically — which puts
#: "high" after "none". Rank it explicitly so "sorted by pyq_weight desc" means
#: what it says.
_WEIGHT_RANK: dict[str, Any] = {
    "$switch": {
        "branches": [
            {"case": {"$eq": ["$node.pyq_weight", "high"]}, "then": 3},
            {"case": {"$eq": ["$node.pyq_weight", "medium"]}, "then": 2},
            {"case": {"$eq": ["$node.pyq_weight", "low"]}, "then": 1},
        ],
        "default": 0,
    }
}

#: Joining the node and dropping archived ones. A topic she archived should not
#: keep surfacing every morning, but its history stays in the database.
_WITH_LIVE_NODE: list[dict[str, Any]] = [
    {
        "$lookup": {
            "from": "syllabus_nodes",
            "localField": "node_id",
            "foreignField": "_id",
            "as": "node",
        }
    },
    {"$unwind": "$node"},
    {"$match": {"node.is_archived": False}},
]

_DUE_PROJECTION: dict[str, Any] = {
    "_id": 0,
    "node_id": 1,
    "title": "$node.title",
    "path": "$node.path",
    "paper": "$node.paper",
    "level": "$node.level",
    "pyq_weight": "$node.pyq_weight",
    "needs_diagram": {"$ifNull": ["$node.needs_diagram", False]},
    "notes": {"$ifNull": ["$node.notes", ""]},
    "next_due": 1,
    "last_reviewed": 1,
    "last_confidence": 1,
    "repetitions": {"$ifNull": ["$repetitions", 0]},
    "lapses": {"$ifNull": ["$lapses", 0]},
}


async def due(
    db: AsyncIOMotorDatabase,
    *,
    date: str | None = None,
    limit: int = DEFAULT_DUE_LIMIT,
) -> dict[str, Any]:
    """Everything due on or before `date`, weakest and heaviest first.

    Ordered by last confidence ascending then PYQ weight descending, per the
    plan: the topics she is least sure of, and among those the ones UPSC asks
    about most, are the ones worth doing before the day runs out. A state with
    no confidence recorded sorts first, which is the right end of the list for
    something the app knows nothing about.
    """
    day = date or today_ist()

    pipeline: list[dict[str, Any]] = [
        {"$match": {"next_due": {"$lte": day}}},
        *_WITH_LIVE_NODE,
        {"$addFields": {"weight_rank": _WEIGHT_RANK}},
        {"$sort": {"last_confidence": 1, "weight_rank": -1, "next_due": 1}},
        # One pass, two answers: the page she sees and the count the heading
        # shows, which stays honest when the page is capped.
        {
            "$facet": {
                "items": [{"$limit": limit}, {"$project": _DUE_PROJECTION}],
                "total": [{"$count": "n"}],
            }
        },
    ]

    result = await db.review_state.aggregate(pipeline).to_list(length=1)
    facet = result[0] if result else {"items": [], "total": []}

    items = [_with_overdue(row, day) for row in facet["items"]]
    total = facet["total"][0]["n"] if facet["total"] else 0
    return {"date": day, "total": total, "items": items}


def _with_overdue(row: dict[str, Any], day: str) -> dict[str, Any]:
    """How late this row is, in whole days. Computed here rather than in the
    pipeline because both ends are already date strings, not timestamps."""
    row["days_overdue"] = max(0, days_between(row["next_due"], day))
    return row


async def upcoming(
    db: AsyncIOMotorDatabase,
    *,
    date: str | None = None,
    days: int = DEFAULT_FORECAST_DAYS,
) -> dict[str, Any]:
    """Counts per day for the forecast bar, plus the standing backlog.

    Every day in the window is present even when nothing falls on it: a bar
    with holes in it is harder to read than one with short columns.
    """
    day = date or today_ist()
    last = shift_day(day, days - 1)

    pipeline: list[dict[str, Any]] = [
        {"$match": {"next_due": {"$lte": last}}},
        *_WITH_LIVE_NODE,
        {
            "$group": {
                # Everything already late collapses into one bucket; which past
                # day it fell on stopped mattering the moment it was missed.
                "_id": {"$cond": [{"$lt": ["$next_due", day]}, "overdue", "$next_due"]},
                "n": {"$sum": 1},
            }
        },
    ]

    counts = {row["_id"]: row["n"] async for row in db.review_state.aggregate(pipeline)}
    return {
        "date": day,
        "overdue": counts.get("overdue", 0),
        "days": [
            {"date": (d := shift_day(day, offset)), "count": counts.get(d, 0)}
            for offset in range(days)
        ],
    }
