"""Browser access rules: only configured frontend origins may call the API."""

from fastapi.testclient import TestClient

from app.main import app

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "Authorization",
}


def test_local_frontend_origin_is_allowed():
    client = TestClient(app)

    response = client.options(
        "/api/v1/health", headers={"Origin": "http://localhost:5173", **PREFLIGHT_HEADERS}
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unknown_origin_is_refused():
    client = TestClient(app)

    response = client.options(
        "/api/v1/health", headers={"Origin": "https://evil.example", **PREFLIGHT_HEADERS}
    )

    assert "access-control-allow-origin" not in response.headers
