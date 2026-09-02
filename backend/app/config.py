"""Application settings, read from environment / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
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
