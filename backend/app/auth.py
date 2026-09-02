"""Single-user API key auth.

Every route except /health depends on `require_api_key`. There are no accounts;
the key is a shared secret held in env on the server and in localStorage on the
phone.
"""

import secrets

from fastapi import Header, HTTPException, status

from app.config import get_settings


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server has no API_KEY configured.",
        )
    if x_api_key is None or not secrets.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key."
        )
