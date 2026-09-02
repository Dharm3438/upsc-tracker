"""Key check.

Deliberately does not touch Mongo: the unlock screen must be able to tell
"wrong key" apart from "database is down".
"""

from fastapi import APIRouter, Depends

from app.auth import require_api_key

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(require_api_key)])


@router.get("/check")
async def check() -> dict:
    return {"ok": True}
