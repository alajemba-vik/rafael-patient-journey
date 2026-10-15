"""Identity provider calls: sign in and verify tokens.

This is the only file that talks to Supabase Auth. Swapping provider (e.g. Keycloak)
means rewriting these two functions and nothing else.
"""

from functools import lru_cache

import httpx
import jwt

from app.config import get_settings
from app.errors import UnauthorizedError


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
