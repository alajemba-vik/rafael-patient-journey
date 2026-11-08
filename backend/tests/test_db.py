"""How the API connects to the database, and the health check that depends on it."""

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import NullPool

from app.config import Settings
from app.db import engine_options, get_db
from app.main import app

SUPABASE_POOLER = "postgresql+psycopg://user:pass@pooler.supabase.example:6543/postgres"


def test_a_long_running_server_keeps_a_checked_pool(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)

    options = engine_options(Settings(_env_file=None, database_url=SUPABASE_POOLER))

    assert options == {"pool_pre_ping": True}


def test_serverless_opens_one_connection_per_request_without_prepared_statements(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    settings = Settings.model_construct(database_url=SUPABASE_POOLER)

    options = engine_options(settings)

    assert options["poolclass"] is NullPool
    assert options["connect_args"] == {"prepare_threshold": None}


def test_health_is_ok_when_the_database_answers(db):
    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_is_unavailable_when_the_database_does_not_answer(db):
    class DownSession:
        def execute(self, *args, **kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    app.dependency_overrides[get_db] = lambda: DownSession()

    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unreachable"
