"""FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db as database
from app.config import get_settings
from app.routers import auth, health, logs, mistakes, review, syllabus, tests

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.mongodb_uri:
        database.connect()
        await database.ensure_indexes()
    else:
        log.warning("MONGODB_URI is empty — starting without a database connection")
    yield
    await database.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="UPSC Tracker API", version="0.1.0", lifespan=lifespan)

    # Order matters. Starlette makes the last-added middleware outermost, so the
    # error catcher goes on first and CORS wraps it — otherwise a 500 comes back
    # without CORS headers and the browser reports an opaque network failure
    # instead of the real error.
    @app.middleware("http")
    async def catch_unhandled(request: Request, call_next):
        try:
            return await call_next(request)
        except database.DatabaseNotConfigured:
            return JSONResponse(
                status_code=503, content={"detail": "Database is not configured."}
            )
        except Exception:  # noqa: BLE001 - converted to a CORS-visible 500
            log.exception("unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(status_code=500, content={"detail": "Internal error."})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["X-API-Key", "Content-Type"],
    )

    # /health for Render's keep-alive ping, /api/health for the frontend client
    # which is configured with the /api base path.
    app.include_router(health.router)
    app.include_router(health.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    app.include_router(syllabus.router, prefix="/api")
    app.include_router(logs.router, prefix="/api")
    app.include_router(review.router, prefix="/api")
    app.include_router(tests.router, prefix="/api")
    app.include_router(mistakes.router, prefix="/api")
    return app


app = create_app()
