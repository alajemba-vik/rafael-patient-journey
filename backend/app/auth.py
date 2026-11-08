"""Identity provider calls: create accounts, sign in and verify tokens.

This is the only file that talks to Supabase Auth. Swapping provider (e.g. Keycloak)
means rewriting these functions and nothing else.

Provider failures are translated here into our own errors, so a wrong password, a rate
limit and an outage reach the user as three different messages, never as a bare 500.
"""

import logging
from functools import lru_cache

import httpx
import jwt

from app.config import get_settings
from app.errors import (
    AppError,
    ConflictError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnauthorizedError,
)

logger = logging.getLogger(__name__)

# One client for every call, so the connection to Supabase is reused instead of reopened
# (a new TLS handshake costs roughly a hundred milliseconds per login).
_http = httpx.Client(timeout=10)

# Supabase error codes meaning "this email already has a login".
_EMAIL_TAKEN_CODES = {"email_exists", "user_already_exists"}


def create_account(email: str, password: str) -> str:
    """Create a confirmed login and return its identity-provider user id.

    Uses the server-only secret key; the email is marked confirmed because staff create
    accounts on people's behalf.
    """
    settings = get_settings()
    response = _post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": settings.supabase_secret_key,
            "Authorization": f"Bearer {settings.supabase_secret_key}",
        },
        json={"email": email, "password": password, "email_confirm": True},
    )
    if response.is_success:
        return response.json()["id"]
    body = _json(response)
    if body.get("error_code") in _EMAIL_TAKEN_CODES:
        raise ConflictError("An account with this email already exists")
    _raise_for_provider_failure(response)
    # Any other refusal is about the input, e.g. a password the provider finds too weak.
    raise AppError(f"The identity provider refused this account: {_message(body)}")


def sign_in(email: str, password: str) -> str:
    """Exchange email + password for an access token."""
    settings = get_settings()
    response = _post(
        f"{settings.supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": settings.supabase_publishable_key},
        json={"email": email, "password": password},
    )
    if response.is_success:
        return response.json()["access_token"]
    _raise_for_provider_failure(response)
    raise UnauthorizedError("Invalid email or password")


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    url = f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(url, lifespan=600)


def verify_token(token: str) -> str:
    """Check the token's signature and expiry; return the identity provider's user id."""
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=get_settings().jwt_audience,
        )
    except jwt.PyJWKClientConnectionError as error:
        logger.error("Could not fetch the identity provider's signing keys: %s", error)
        raise ServiceUnavailableError("Sign-in is unavailable right now") from error
    except jwt.PyJWTError as error:
        raise UnauthorizedError("Invalid or expired token") from error
    return claims["sub"]


def _post(
    url: str,
    *,
    headers: dict[str, str],
    json: dict[str, object],
    params: dict[str, str] | None = None,
) -> httpx.Response:
    try:
        return _http.post(url, headers=headers, json=json, params=params)
    except httpx.HTTPError as error:
        logger.error("Identity provider unreachable: %s", error)
        raise ServiceUnavailableError("Sign-in is unavailable right now") from error


def _raise_for_provider_failure(response: httpx.Response) -> None:
    """Rate limits and provider-side errors: not the user's fault, so not a 4xx about input."""
    if response.status_code == 429:
        raise TooManyRequestsError("Too many attempts. Wait a moment, then try again")
    if response.status_code >= 500 or response.status_code in {401, 403}:
        # 401/403 from the provider mean our own keys are wrong: a configuration problem.
        # Only the status and code are logged: the body can echo the email address.
        code = _json(response).get("error_code", "")
        logger.error("Identity provider error %s %s", response.status_code, code)
        raise ServiceUnavailableError("Sign-in is unavailable right now")


def _json(response: httpx.Response) -> dict[str, object]:
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _message(body: dict[str, object]) -> str:
    return str(body.get("msg") or body.get("message") or body.get("error_description") or "")
