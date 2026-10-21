"""Account rules: only admins create and list accounts.

The identity provider is replaced by a fake, so no Supabase is needed. All data is synthetic.
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.audit import AuditEvent
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role

NEW_STAFF = {
    "email": "Morgan.Accueil@example.com",
    "full_name": "Morgan Accueil",
    "password": "synthetic-password-1",
    "role": "secretary",
}
NON_ADMIN_ROLES = [Role.PATIENT, Role.SECRETARY, Role.PROFESSIONAL, Role.COORDINATOR]


@pytest.fixture(autouse=True)
def fake_identity_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "create_account", lambda email, password: str(uuid.uuid4()))


def add_user(db: Session, role: Role, email: str = "existing@example.com") -> User:
    user = User(auth_subject=str(uuid.uuid4()), email=email, full_name="Alex Synthetic", role=role)
    db.add(user)
    db.commit()
    return user


# --- create ---------------------------------------------------------------


def test_admin_creates_account_and_it_is_audited(db, client_as):
    response = client_as(Role.ADMIN).post("/api/v1/auth/users", json=NEW_STAFF)

    assert response.status_code == 201
    assert response.json()["email"] == "morgan.accueil@example.com"
    assert response.json()["role"] == "secretary"
    assert db.scalar(select(AuditEvent.action)) == "user.create"


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_create_accounts(db, client_as, role):
    response = client_as(role).post("/api/v1/auth/users", json=NEW_STAFF)

    assert response.status_code == 403
    assert db.scalar(select(User)) is None


def test_duplicate_email_is_refused_whatever_its_case(db, client_as):
    add_user(db, Role.SECRETARY, email="morgan.accueil@example.com")

    response = client_as(Role.ADMIN).post("/api/v1/auth/users", json=NEW_STAFF)

    assert response.status_code == 409


# --- list -----------------------------------------------------------------


def test_admin_lists_accounts(db, client_as):
    add_user(db, Role.PROFESSIONAL)

    body = client_as(Role.ADMIN).get("/api/v1/auth/users").json()

    assert [u["email"] for u in body] == ["existing@example.com"]


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_list_accounts(db, client_as, role):
    response = client_as(role).get("/api/v1/auth/users")

    assert response.status_code == 403


# --- care staff -----------------------------------------------------------


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.SECRETARY, Role.ADMIN])
def test_care_staff_list_shows_practitioners_and_coordinators(db, client_as, role):
    add_user(db, Role.PROFESSIONAL, "pro@example.com")
    add_user(db, Role.COORDINATOR, "coord@example.com")
    add_user(db, Role.PATIENT, "patient@example.com")

    body = client_as(role).get("/api/v1/auth/care-staff").json()

    assert sorted(u["email"] for u in body) == ["coord@example.com", "pro@example.com"]


@pytest.mark.parametrize("role", [Role.PATIENT, Role.PROFESSIONAL])
def test_care_staff_list_is_refused_to_others(db, client_as, role):
    response = client_as(role).get("/api/v1/auth/care-staff")

    assert response.status_code == 403
