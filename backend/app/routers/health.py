"""Unauthenticated health check.

Kept outside the API-key dependency so Render's keep-alive ping and the
frontend's connectivity check both work without a key.
"""

from fastapi import APIRouter

from app import db as database
from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    mongo_ok = await database.ping() if settings.mongodb_uri else False
    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongo": mongo_ok,
        "configured": settings.is_configured,
    }
