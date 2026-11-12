"""Public API of identity_access. Other modules use `CurrentUser`, `Role` and `get_current_user`."""

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, auth
from app.audit import AuditEvent
from app.db import get_db
from app.errors import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.modules.identity_access.models import Role, User
from app.modules.identity_access.schemas import AuditEventOut, UserCreate, UserOut, UserUpdate

__all__ = [
    "CurrentUser",
    "Role",
    "create_user",
    "get_current_user",
    "get_role",
    "get_users",
    "list_audit_events",
    "list_ids_with_role",
    "list_care_staff",
    "list_users",
    "login",
    "update_user",
]

_bearer = HTTPBearer(auto_error=False)

AUDIT_LIST_LIMIT = 200


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
    """Admins create every account, staff and patients alike, with an initial password."""
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can create accounts")
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ConflictError("An account with this email already exists")

    subject = auth.create_account(email, data.password)
    account = User(
        auth_subject=subject,
        email=email,
        full_name=data.full_name,
        role=data.role,
        discipline=data.discipline,
    )
    db.add(account)
    db.flush()
    audit.record(db, user.id, "user.create", None)
    db.commit()
    return UserOut.model_validate(account)


def update_user(db: Session, user: CurrentUser, user_id: uuid.UUID, data: UserUpdate) -> UserOut:
    """Admins rename an account, change a staff role, or deactivate and reactivate a login."""
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can change accounts")
    account = db.get(User, user_id, with_for_update=True)
    if account is None:
        raise NotFoundError("Account not found")
    changes = {
        field: value
        for field, value in data.model_dump(exclude_unset=True).items()
        if value is not None or field == "discipline"
    }
    new_role = changes.get("role", account.role)
    # An admin who demotes or deactivates themselves could leave the platform with no admin.
    if account.id == user.id and (new_role != account.role or changes.get("is_active") is False):
        raise ConflictError("You can't change your own role or deactivate your own account")
    # A patient login is linked to a patient record; a staff login must never inherit that link.
    if new_role != account.role and Role.PATIENT in {new_role, account.role}:
        raise ConflictError("A patient account can't become a staff account, or the reverse")

    for field, value in changes.items():
        setattr(account, field, value)
    audit.record(db, user.id, "user.update", None)
    db.commit()
    return UserOut.model_validate(account)


def list_users(db: Session, user: CurrentUser) -> list[UserOut]:
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can list accounts")
    users = db.scalars(select(User).order_by(User.full_name))
    return [UserOut.model_validate(u) for u in users]


def list_audit_events(
    db: Session,
    user: CurrentUser,
    patient_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
) -> list[AuditEventOut]:
    """Admins read the audit trail, newest first: who saw a patient, or what an account did.

    Reading it is recorded too, so the trail also shows who looked into whom.
    """
    if user.role != Role.ADMIN:
        audit.record(db, user.id, "audit.read.denied", patient_id)
        db.commit()
        raise ForbiddenError("Only admins can read the audit trail")
    # shortcut: the newest AUDIT_LIST_LIMIT events only, no paging; add a "before" cursor
    # when admins need to go further back than the filters allow.
    query = (
        select(AuditEvent, User.full_name)
        .outerjoin(User, User.id == AuditEvent.actor_id)
        .order_by(AuditEvent.occurred_at.desc())
        .limit(AUDIT_LIST_LIMIT)
    )
    if patient_id is not None:
        query = query.where(AuditEvent.patient_id == patient_id)
    if actor_id is not None:
        query = query.where(AuditEvent.actor_id == actor_id)
    events = [
        AuditEventOut(
            id=event.id,
            occurred_at=event.occurred_at,
            actor_id=event.actor_id,
            actor_name=name,
            action=event.action,
            patient_id=event.patient_id,
        )
        for event, name in db.execute(query)
    ]
    audit.record(db, user.id, "audit.read", patient_id)
    db.commit()
    return events


def list_care_staff(db: Session, user: CurrentUser) -> list[UserOut]:
    """Practitioners and coordinators, to choose from when building a care team or booking."""
    if user.role not in {Role.COORDINATOR, Role.SECRETARY, Role.ADMIN}:
        raise ForbiddenError("You are not allowed to list staff")
    query = select(User).where(
        User.role.in_([Role.PROFESSIONAL, Role.COORDINATOR]), User.is_active.is_(True)
    )
    return [UserOut.model_validate(u) for u in db.scalars(query.order_by(User.full_name))]


def list_ids_with_role(db: Session, role: Role) -> list[uuid.UUID]:
    """For other modules: every account id with this role."""
    return list(db.scalars(select(User.id).where(User.role == role)))


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
    if not user.is_active:
        raise UnauthorizedError("This account is deactivated")
    return CurrentUser(id=user.id, role=user.role)
