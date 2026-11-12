"""Account rules: only admins create, list and change accounts.

The identity provider is replaced by a fake, so no Supabase is needed. All data is synthetic.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.audit import AuditEvent
from app.errors import UnauthorizedError
from app.modules.identity_access import service
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


def test_care_staff_list_leaves_out_deactivated_accounts(db, client_as):
    account = add_user(db, Role.PROFESSIONAL, "pro@example.com")
    account.is_active = False
    db.commit()

    body = client_as(Role.COORDINATOR).get("/api/v1/auth/care-staff").json()

    assert body == []


# --- update ---------------------------------------------------------------


def test_admin_changes_a_staff_role_and_it_is_audited(db, client_as):
    account = add_user(db, Role.PROFESSIONAL)

    response = client_as(Role.ADMIN).patch(
        f"/api/v1/auth/users/{account.id}", json={"role": "coordinator"}
    )

    assert response.status_code == 200
    assert response.json()["role"] == "coordinator"
    assert db.scalar(select(AuditEvent.action)) == "user.update"


def test_admin_deactivates_then_reactivates_an_account(db, client_as):
    account = add_user(db, Role.SECRETARY)
    admin = client_as(Role.ADMIN)

    off = admin.patch(f"/api/v1/auth/users/{account.id}", json={"is_active": False})
    on = admin.patch(f"/api/v1/auth/users/{account.id}", json={"is_active": True})

    assert off.json()["is_active"] is False
    assert on.json()["is_active"] is True


def test_discipline_sent_as_null_is_cleared_and_other_fields_are_kept(db, client_as):
    account = add_user(db, Role.PROFESSIONAL)
    account.discipline = "Sophrologie"
    db.commit()

    response = client_as(Role.ADMIN).patch(
        f"/api/v1/auth/users/{account.id}", json={"discipline": None}
    )

    assert response.json()["discipline"] is None
    assert response.json()["full_name"] == "Alex Synthetic"


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_change_accounts(db, client_as, role):
    account = add_user(db, Role.PROFESSIONAL)

    response = client_as(role).patch(f"/api/v1/auth/users/{account.id}", json={"role": "admin"})

    assert response.status_code == 403
    db.refresh(account)
    assert account.role == Role.PROFESSIONAL


@pytest.mark.parametrize("change", [{"role": "secretary"}, {"is_active": False}])
def test_admin_cannot_demote_or_deactivate_themselves(db, client_as, change):
    admin = add_user(db, Role.ADMIN)

    response = client_as(Role.ADMIN, admin.id).patch(f"/api/v1/auth/users/{admin.id}", json=change)

    assert response.status_code == 409


@pytest.mark.parametrize(
    ("current", "wanted"), [(Role.PATIENT, "secretary"), (Role.SECRETARY, "patient")]
)
def test_patient_and_staff_accounts_never_swap(db, client_as, current, wanted):
    account = add_user(db, current)

    response = client_as(Role.ADMIN).patch(
        f"/api/v1/auth/users/{account.id}", json={"role": wanted}
    )

    assert response.status_code == 409


def test_changing_an_unknown_account_is_not_found(db, client_as):
    response = client_as(Role.ADMIN).patch(
        f"/api/v1/auth/users/{uuid.uuid4()}", json={"role": "admin"}
    )

    assert response.status_code == 404


# --- login check ----------------------------------------------------------


def test_deactivated_account_is_refused_even_with_a_valid_token(db, monkeypatch):
    account = add_user(db, Role.PROFESSIONAL)
    account.is_active = False
    db.commit()
    monkeypatch.setattr(auth, "verify_token", lambda token: account.auth_subject)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="synthetic-token")

    with pytest.raises(UnauthorizedError):
        service.get_current_user(credentials, db)


# --- audit trail ----------------------------------------------------------


def add_event(
    db: Session, actor_id: uuid.UUID, action: str, patient_id: uuid.UUID, minutes_ago: int
) -> None:
    occurred_at = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    db.add(
        AuditEvent(actor_id=actor_id, action=action, patient_id=patient_id, occurred_at=occurred_at)
    )
    db.commit()


def test_admin_reads_the_audit_trail_newest_first_with_names(db, client_as):
    actor = add_user(db, Role.PROFESSIONAL)
    patient_id = uuid.uuid4()
    add_event(db, actor.id, "patient.read", patient_id, minutes_ago=10)
    add_event(db, actor.id, "patient.update", patient_id, minutes_ago=5)

    body = client_as(Role.ADMIN).get("/api/v1/auth/audit-events").json()

    assert [e["action"] for e in body] == ["patient.update", "patient.read"]
    assert body[0]["actor_name"] == "Alex Synthetic"
    assert body[0]["patient_id"] == str(patient_id)


def test_audit_trail_filters_by_patient_and_by_account(db, client_as):
    first, second = uuid.uuid4(), uuid.uuid4()
    patient_a, patient_b = uuid.uuid4(), uuid.uuid4()
    add_event(db, first, "patient.read", patient_a, minutes_ago=3)
    add_event(db, second, "patient.read", patient_b, minutes_ago=2)
    admin = client_as(Role.ADMIN)

    by_patient = admin.get("/api/v1/auth/audit-events", params={"patient_id": str(patient_a)})
    by_account = admin.get("/api/v1/auth/audit-events", params={"actor_id": str(second)})

    assert [e["actor_id"] for e in by_patient.json()] == [str(first)]
    assert [e["patient_id"] for e in by_account.json()] == [str(patient_b)]


def test_reading_the_audit_trail_is_itself_audited(db, client_as):
    patient_id = uuid.uuid4()

    client_as(Role.ADMIN).get("/api/v1/auth/audit-events", params={"patient_id": str(patient_id)})

    event = db.scalar(select(AuditEvent))
    assert (event.action, event.patient_id) == ("audit.read", patient_id)


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_read_the_audit_trail_and_the_attempt_is_recorded(db, client_as, role):
    add_event(db, uuid.uuid4(), "patient.read", uuid.uuid4(), minutes_ago=1)

    response = client_as(role).get("/api/v1/auth/audit-events")

    assert response.status_code == 403
    assert "audit.read.denied" in db.scalars(select(AuditEvent.action)).all()
