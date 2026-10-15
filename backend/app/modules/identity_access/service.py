"""Public API of identity_access. Other modules use `CurrentUser`, `Role` and `get_current_user`."""

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.db import get_db
from app.errors import UnauthorizedError
from app.modules.identity_access.models import Role, User

__all__ = ["CurrentUser", "Role", "get_current_user", "login"]

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    role: Role


def login(email: str, password: str) -> str:
    return auth.sign_in(email, password)


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Unknown user")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """FastAPI dependency: the authenticated caller, or 401."""
    if credentials is None:
        raise UnauthorizedError("Missing bearer token")
    subject = auth.verify_token(credentials.credentials)
    user = db.scalar(select(User).where(User.auth_subject == subject))
    if user is None:
        raise UnauthorizedError("No account for this identity")
    return CurrentUser(id=user.id, role=user.role)
