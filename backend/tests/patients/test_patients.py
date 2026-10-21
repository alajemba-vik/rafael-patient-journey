"""Patient access rules: every role, allowed and denied. All data here is synthetic."""

import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.patients.models import Patient

NEW_PATIENT = {"first_name": "Camille", "last_name": "Test", "birth_date": "1980-01-01"}


def add_patient(db: Session, user_id: uuid.UUID | None = None) -> Patient:
    patient = Patient(
        first_name="Alex",
        last_name="Synthetic",
        birth_date=date(1975, 5, 5),
        medical_summary="Synthetic clinical note",
        user_id=user_id,
    )
    db.add(patient)
    db.commit()
    return patient


def add_account(db: Session, role: Role) -> User:
    account = User(
        auth_subject=str(uuid.uuid4()),
        email=f"{uuid.uuid4().hex}@example.com",
        full_name="Alex Synthetic",
        role=role,
    )
    db.add(account)
    db.commit()
    return account


def assign(db: Session, professional_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    db.add(CareAssignment(professional_id=professional_id, patient_id=patient_id))
    db.commit()


# --- create ---------------------------------------------------------------


def test_secretary_registers_patient_and_it_is_audited(db, client_as):
    response = client_as(Role.SECRETARY).post("/api/v1/patients", json=NEW_PATIENT)

    assert response.status_code == 201
    assert db.scalar(select(AuditEvent.action)) == "patient.create"


@pytest.mark.parametrize("field", ["first_name", "last_name"])
def test_blank_names_are_refused(db, client_as, field):
    response = client_as(Role.SECRETARY).post("/api/v1/patients", json={**NEW_PATIENT, field: "  "})

    assert response.status_code == 422


def test_professional_cannot_register_patient(db, client_as):
    response = client_as(Role.PROFESSIONAL).post("/api/v1/patients", json=NEW_PATIENT)

    assert response.status_code == 403


def test_secretary_links_patient_to_their_login(db, client_as):
    account = add_account(db, Role.PATIENT)

    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "user_id": str(account.id)}
    )

    assert response.status_code == 201
    assert db.scalar(select(Patient.user_id)) == account.id


def test_staff_login_cannot_be_linked_to_a_patient(db, client_as):
    account = add_account(db, Role.PROFESSIONAL)

    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "user_id": str(account.id)}
    )

    assert response.status_code == 404


def test_login_already_linked_cannot_be_linked_again(db, client_as):
    account = add_account(db, Role.PATIENT)
    add_patient(db, user_id=account.id)

    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "user_id": str(account.id)}
    )

    assert response.status_code == 409


# --- read -----------------------------------------------------------------


def test_secretary_sees_administrative_data_only(db, client_as):
    patient = add_patient(db)

    body = client_as(Role.SECRETARY).get(f"/api/v1/patients/{patient.id}").json()

    assert body["last_name"] == "Synthetic"
    assert "medical_summary" not in body


def test_professional_in_care_team_sees_clinical_data(db, client_as):
    professional_id = uuid.uuid4()
    patient = add_patient(db)
    assign(db, professional_id, patient.id)

    response = client_as(Role.PROFESSIONAL, professional_id).get(f"/api/v1/patients/{patient.id}")

    assert response.status_code == 200
    assert response.json()["medical_summary"] == "Synthetic clinical note"


def test_professional_outside_care_team_is_denied_and_audited(db, client_as):
    patient = add_patient(db)

    response = client_as(Role.PROFESSIONAL).get(f"/api/v1/patients/{patient.id}")

    assert response.status_code == 403
    assert db.scalar(select(AuditEvent.action)) == "patient.read.denied"


def test_patient_sees_own_record(db, client_as):
    user_id = uuid.uuid4()
    patient = add_patient(db, user_id=user_id)

    response = client_as(Role.PATIENT, user_id).get(f"/api/v1/patients/{patient.id}")

    assert response.status_code == 200
    assert response.json()["medical_summary"] == "Synthetic clinical note"


def test_patient_cannot_see_another_patient(db, client_as):
    other = add_patient(db, user_id=uuid.uuid4())

    response = client_as(Role.PATIENT).get(f"/api/v1/patients/{other.id}")

    assert response.status_code == 403


# --- list -----------------------------------------------------------------


def test_professional_lists_only_their_patients(db, client_as):
    professional_id = uuid.uuid4()
    mine = add_patient(db)
    add_patient(db)
    assign(db, professional_id, mine.id)

    body = client_as(Role.PROFESSIONAL, professional_id).get("/api/v1/patients").json()

    assert [p["id"] for p in body] == [str(mine.id)]


def test_patient_cannot_list_patients(db, client_as):
    response = client_as(Role.PATIENT).get("/api/v1/patients")

    assert response.status_code == 403


def test_coordinator_sees_unassigned_patient_administratively(db, client_as):
    patient = add_patient(db)

    body = client_as(Role.COORDINATOR).get(f"/api/v1/patients/{patient.id}").json()

    assert body["last_name"] == "Synthetic"
    assert "medical_summary" not in body


def test_coordinator_cannot_see_another_coordinators_patient(db, client_as):
    patient = add_patient(db)
    other_coordinator = add_account(db, Role.COORDINATOR)
    assign(db, other_coordinator.id, patient.id)

    response = client_as(Role.COORDINATOR).get(f"/api/v1/patients/{patient.id}")

    assert response.status_code == 403


def test_coordinator_lists_own_patients_or_unassigned_ones(db, client_as):
    coordinator_id = add_account(db, Role.COORDINATOR).id
    mine = add_patient(db)
    assign(db, coordinator_id, mine.id)
    unassigned = add_patient(db)
    taken = add_patient(db)
    assign(db, add_account(db, Role.COORDINATOR).id, taken.id)
    client = client_as(Role.COORDINATOR, coordinator_id)

    own = client.get("/api/v1/patients").json()
    waiting = client.get("/api/v1/patients", params={"unassigned": True}).json()

    assert [p["id"] for p in own] == [str(mine.id)]
    assert [p["id"] for p in waiting] == [str(unassigned.id)]


def test_search_matches_the_start_of_a_name_and_listing_is_audited(db, client_as):
    add_patient(db)

    found = client_as(Role.SECRETARY).get("/api/v1/patients", params={"search": "synth"}).json()
    wildcard = client_as(Role.SECRETARY).get("/api/v1/patients", params={"search": "%"}).json()

    assert len(found) == 1
    assert wildcard == []
    assert db.scalar(select(AuditEvent.action).where(AuditEvent.action == "patient.list"))


# --- update ---------------------------------------------------------------


def test_admin_links_a_login_and_updates_contact_details(db, client_as):
    patient = add_patient(db)
    account = add_account(db, Role.PATIENT)

    response = client_as(Role.ADMIN).patch(
        f"/api/v1/patients/{patient.id}",
        json={"user_id": str(account.id), "phone": "01 00 00 00 00"},
    )

    assert response.status_code == 200
    assert response.json()["has_account"] is True
    assert response.json()["phone"] == "01 00 00 00 00"
    assert db.scalar(select(AuditEvent.action).where(AuditEvent.action == "patient.update"))


def test_staff_login_cannot_be_linked_on_update(db, client_as):
    patient = add_patient(db)
    staff = add_account(db, Role.PROFESSIONAL)

    response = client_as(Role.SECRETARY).patch(
        f"/api/v1/patients/{patient.id}", json={"user_id": str(staff.id)}
    )

    assert response.status_code == 404


@pytest.mark.parametrize("role", [Role.PATIENT, Role.PROFESSIONAL, Role.COORDINATOR])
def test_care_roles_and_patients_cannot_update_and_it_is_audited(db, client_as, role):
    patient = add_patient(db)

    response = client_as(role).patch(f"/api/v1/patients/{patient.id}", json={"phone": "x"})

    assert response.status_code == 403
    assert db.scalar(select(AuditEvent.action)) == "patient.update.denied"
