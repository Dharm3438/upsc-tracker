"""Application settings, read from environment / .env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

#: Anchored to the package rather than the process's working directory, so the
#: app finds its settings whether it is started from `backend/` or from the
#: repo root with `uvicorn --app-dir backend`.
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    mongodb_uri: str = ""
    mongodb_db: str = "upsc_tracker"
    api_key: str = ""
    allowed_origins: str = "http://localhost:5173"
    tz: str = "Asia/Kolkata"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_configured(self) -> bool:
        """False until MONGODB_URI and API_KEY are filled in locally."""
        return bool(self.mongodb_uri and self.api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
