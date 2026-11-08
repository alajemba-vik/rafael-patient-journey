"""Every response carries a request id; unexpected errors become a logged, CORS-safe 500;
logs show route templates, never query strings (a patient search is a name)."""

import logging

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.modules.identity_access.service import Role

ORIGIN = get_settings().cors_origins[0]


def test_every_response_gets_a_request_id(db):
    response = TestClient(app).get("/api/v1/health")

    assert len(response.headers["X-Request-ID"]) == 32


def test_a_valid_incoming_request_id_is_kept_and_a_bogus_one_replaced(db):
    client = TestClient(app)

    kept = client.get("/api/v1/health", headers={"X-Request-ID": "front-123"})
    replaced = client.get("/api/v1/health", headers={"X-Request-ID": "bad id\n<script>"})

    assert kept.headers["X-Request-ID"] == "front-123"
    assert replaced.headers["X-Request-ID"] != "bad id\n<script>"


def test_an_unexpected_error_is_a_logged_500_with_cors_headers(db, client_as, monkeypatch, caplog):
    from app.modules.patients import service

    def crash(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(service, "list_patients", crash)
    client = client_as(Role.SECRETARY)
    client.raise_server_exceptions = False

    with caplog.at_level(logging.ERROR, logger="app.requests"):
        response = client.get("/api/v1/patients", headers={"Origin": ORIGIN})

    assert response.status_code == 500
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "boom" not in response.text
    assert any("Unhandled error" in r.message for r in caplog.records)


def test_logs_show_the_route_template_not_the_query_or_ids(db, client_as, caplog):
    with caplog.at_level(logging.INFO, logger="app.requests"):
        client_as(Role.SECRETARY).get("/api/v1/patients", params={"search": "Synthetic"})

    logged = " ".join(r.getMessage() for r in caplog.records if r.name == "app.requests")
    assert "GET /api/v1/patients 200" in logged
    assert "Synthetic" not in logged


def test_ids_in_the_path_are_logged_as_names(db, client_as, caplog):
    patient_id = "3f0b7d1e-0000-4000-8000-000000000001"

    with caplog.at_level(logging.INFO, logger="app.requests"):
        client_as(Role.SECRETARY).get(f"/api/v1/patients/{patient_id}")

    logged = " ".join(r.getMessage() for r in caplog.records if r.name == "app.requests")
    assert "/api/v1/patients/{patient_id}" in logged
    assert patient_id not in logged
