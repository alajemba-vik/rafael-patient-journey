"""Application settings, read from environment variables or a `.env` file.

Locally, sensible defaults let the API start with no setup. In production the settings
that matter are required: a deployment that forgot `DATABASE_URL` must fail at startup,
not quietly run on an empty local SQLite file.
"""

import os
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_DATABASE_URL = "sqlite:///./local.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "production" turns on the startup checks below. Vercel deployments count as
    # production even if APP_ENV isn't set (Vercel sets VERCEL=1).
    app_env: Literal["local", "production"] = "local"
    database_url: str = LOCAL_DATABASE_URL
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    # Server-only key for creating accounts. Never expose it to the frontend.
    supabase_secret_key: str = ""
    jwt_audience: str = "authenticated"
    # The Institute's local time: what "today" and "this month" mean.
    institute_time_zone: str = "Europe/Paris"
    # Frontend addresses allowed to call the API from a browser. JSON list in .env.
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production" or bool(os.environ.get("VERCEL"))

    @model_validator(mode="after")
    def _require_production_settings(self) -> "Settings":
        if not self.is_production:
            return self
        missing = [
            name.upper()
            for name, value in {
                "database_url": self.database_url != LOCAL_DATABASE_URL
                and not self.database_url.startswith("sqlite"),
                "supabase_url": self.supabase_url,
                "supabase_publishable_key": self.supabase_publishable_key,
                "supabase_secret_key": self.supabase_secret_key,
            }.items()
            if not value
        ]
        if missing:
            raise ValueError(f"Production needs these settings: {', '.join(missing)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
