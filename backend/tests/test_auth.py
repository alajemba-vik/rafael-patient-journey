"""Identity provider failures reach the user as the right error, never as a bare 500.

The provider is replaced by a fake HTTP transport: no Supabase is called.
"""

import httpx
import pytest

from app import auth
from app.config import get_settings
from app.errors import (
    AppError,
    ConflictError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnauthorizedError,
)


@pytest.fixture(autouse=True)
def provider_address(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "supabase_url", "https://project.supabase.example")


def provider_replies(monkeypatch: pytest.MonkeyPatch, status: int, body: dict) -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json=body))
    monkeypatch.setattr(auth, "_http", httpx.Client(transport=transport))


def provider_is_down(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(fail)))


def test_sign_in_returns_the_token(monkeypatch):
    provider_replies(monkeypatch, 200, {"access_token": "token-1"})

    assert auth.sign_in("alex@example.org", "synthetic") == "token-1"


def test_wrong_credentials_are_unauthorized(monkeypatch):
    provider_replies(monkeypatch, 400, {"error_code": "invalid_credentials"})

    with pytest.raises(UnauthorizedError):
        auth.sign_in("alex@example.org", "wrong")


def test_a_rate_limited_sign_in_says_so(monkeypatch):
    provider_replies(monkeypatch, 429, {"error_code": "over_request_rate_limit"})

    with pytest.raises(TooManyRequestsError):
        auth.sign_in("alex@example.org", "synthetic")


@pytest.mark.parametrize("status", [500, 503])
def test_a_provider_outage_is_not_reported_as_a_wrong_password(monkeypatch, status):
    provider_replies(monkeypatch, status, {})

    with pytest.raises(ServiceUnavailableError):
        auth.sign_in("alex@example.org", "synthetic")


def test_an_unreachable_provider_is_unavailable(monkeypatch):
    provider_is_down(monkeypatch)

    with pytest.raises(ServiceUnavailableError):
        auth.sign_in("alex@example.org", "synthetic")


def test_wrong_server_keys_are_a_configuration_problem_not_the_users(monkeypatch):
    provider_replies(monkeypatch, 401, {"message": "Invalid API key"})

    with pytest.raises(ServiceUnavailableError):
        auth.create_account("alex@example.org", "synthetic-password")


def test_an_email_the_provider_already_knows_is_a_conflict(monkeypatch):
    provider_replies(monkeypatch, 422, {"error_code": "email_exists", "msg": "already registered"})

    with pytest.raises(ConflictError):
        auth.create_account("alex@example.org", "synthetic-password")


def test_a_refused_password_explains_why(monkeypatch):
    provider_replies(monkeypatch, 422, {"error_code": "weak_password", "msg": "Password too short"})

    with pytest.raises(AppError, match="Password too short") as raised:
        auth.create_account("alex@example.org", "x")

    assert raised.value.status_code == 400
