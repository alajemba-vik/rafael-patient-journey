"""Production refuses to start without its real settings; local development needs none."""

import pytest
from pydantic import ValidationError

from app.config import Settings

SETTINGS_FROM_ENVIRONMENT = [
    "APP_ENV",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "VERCEL",
]


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test states its settings: CI's own DATABASE_URL (or a developer's) mustn't leak in."""
    for name in SETTINGS_FROM_ENVIRONMENT:
        monkeypatch.delenv(name, raising=False)


PRODUCTION = {
    "app_env": "production",
    "database_url": "postgresql+psycopg://user:pass@db.example:5432/rafael",
    "supabase_url": "https://project.supabase.co",
    "supabase_publishable_key": "publishable",
    "supabase_secret_key": "secret",
}


def test_local_development_starts_with_no_settings():
    settings = Settings(_env_file=None)

    assert settings.database_url.startswith("sqlite")


def test_production_starts_with_its_settings():
    assert Settings(_env_file=None, **PRODUCTION).is_production


@pytest.mark.parametrize("missing", ["database_url", "supabase_url", "supabase_secret_key"])
def test_production_without_a_setting_refuses_to_start(missing):
    settings = {k: v for k, v in PRODUCTION.items() if k != missing}

    with pytest.raises(ValidationError, match=missing.upper()):
        Settings(_env_file=None, **settings)


def test_production_refuses_a_sqlite_database():
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None, **{**PRODUCTION, "database_url": "sqlite:///./prod.db"})


def test_a_vercel_deployment_counts_as_production(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")

    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="local")
