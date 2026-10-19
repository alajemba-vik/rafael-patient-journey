"""Identity provider calls: create accounts, sign in and verify tokens.

This is the only file that talks to Supabase Auth. Swapping provider (e.g. Keycloak)
means rewriting these functions and nothing else.
"""

from functools import lru_cache

import httpx
import jwt

from app.config import get_settings
from app.errors import ConflictError, UnauthorizedError


def create_account(email: str, password: str) -> str:
    """Create a confirmed login and return its identity-provider user id.

    Uses the server-only secret key; the email is marked confirmed because staff create
    accounts on people's behalf.
    """
    settings = get_settings()
    response = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": settings.supabase_secret_key,
            "Authorization": f"Bearer {settings.supabase_secret_key}",
        },
        json={"email": email, "password": password, "email_confirm": True},
        timeout=10,
    )
    if response.status_code == 422 and response.json().get("error_code") == "email_exists":
        raise ConflictError("An account with this email already exists")
    response.raise_for_status()
    return response.json()["id"]


def sign_in(email: str, password: str) -> str:
    """Exchange email + password for an access token."""
    settings = get_settings()
    response = httpx.post(
        f"{settings.supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": settings.supabase_publishable_key},
        json={"email": email, "password": password},
        timeout=10,
    )
    if response.status_code != 200:
        raise UnauthorizedError("Invalid email or password")
    return response.json()["access_token"]


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
    except jwt.PyJWTError as error:
        raise UnauthorizedError("Invalid or expired token") from error
    return claims["sub"]
