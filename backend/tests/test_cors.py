"""Browsers may call the API only from the configured frontend origins."""

from fastapi.testclient import TestClient

from app.main import app


def test_unknown_origin_is_refused():
    client = TestClient(app)

    response = client.options(
        "/api/v1/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in response.headers
