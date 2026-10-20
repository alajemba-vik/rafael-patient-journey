"""Public API of identity_access. Other modules use `CurrentUser`, `Role` and `get_current_user`."""

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, auth
from app.db import get_db
from app.errors import ConflictError, ForbiddenError, UnauthorizedError
from app.modules.identity_access.models import Role, User
from app.modules.identity_access.schemas import UserCreate, UserOut

__all__ = [
    "CurrentUser",
    "Role",
    "create_user",
    "get_current_user",
    "get_role",
    "get_users",
    "list_care_staff",
    "list_users",
    "login",
]

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


def create_user(db: Session, user: CurrentUser, data: UserCreate) -> UserOut:
    """Admins create every account, staff and patients alike."""
    # TODO(validate): should patients get an invitation email to set their own password
    # instead of an initial password chosen by staff?
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can create accounts")
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ConflictError("An account with this email already exists")

    subject = auth.create_account(email, data.password)
    account = User(auth_subject=subject, email=email, full_name=data.full_name, role=data.role)
    db.add(account)
    db.flush()
    audit.record(db, user.id, "user.create", None)
    db.commit()
    return UserOut.model_validate(account)


def list_users(db: Session, user: CurrentUser) -> list[UserOut]:
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can list accounts")
    users = db.scalars(select(User).order_by(User.full_name))
    return [UserOut.model_validate(u) for u in users]


def list_care_staff(db: Session, user: CurrentUser) -> list[UserOut]:
    """Practitioners and coordinators, to choose from when building a care team or booking."""
    if user.role not in {Role.COORDINATOR, Role.SECRETARY, Role.ADMIN}:
        raise ForbiddenError("You are not allowed to list staff")
    query = select(User).where(User.role.in_([Role.PROFESSIONAL, Role.COORDINATOR]))
    return [UserOut.model_validate(u) for u in db.scalars(query.order_by(User.full_name))]


def get_role(db: Session, user_id: uuid.UUID) -> Role | None:
    """The account's role, or None if there is no such account."""
    return db.scalar(select(User.role).where(User.id == user_id))


def get_users(db: Session, user_ids: list[uuid.UUID]) -> list[UserOut]:
    """Names and roles for a set of accounts, for other modules that display people."""
    users = db.scalars(select(User).where(User.id.in_(user_ids)).order_by(User.full_name))
    return [UserOut.model_validate(u) for u in users]


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
