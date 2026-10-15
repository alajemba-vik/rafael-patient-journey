"""Application settings, read from environment variables or a `.env` file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./local.db"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    jwt_audience: str = "authenticated"


@lru_cache
def get_settings() -> Settings:
    return Settings()
