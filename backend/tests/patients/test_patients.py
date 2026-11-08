"""Patient access rules: every role, allowed and denied. All data here is synthetic."""

import uuid
from datetime import date

import pytest
from sqlalchemy import func, select
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
    # Stored without spaces, so a phone search finds it however it was typed.
    assert response.json()["phone"] == "0100000000"
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

    response = client_as(role).patch(f"/api/v1/patients/{patient.id}", json={"phone": "0100000000"})

    assert response.status_code == 403
    assert db.scalar(select(AuditEvent.action)) == "patient.update.denied"


# --- registration safeguards ----------------------------------------------


def test_registering_the_same_person_twice_is_refused(db, client_as):
    client = client_as(Role.SECRETARY)
    client.post("/api/v1/patients", json=NEW_PATIENT)

    same_person = {**NEW_PATIENT, "first_name": " camille ", "last_name": "TEST"}
    response = client.post("/api/v1/patients", json=same_person)

    assert response.status_code == 409
    assert db.scalar(select(func.count()).select_from(Patient)) == 1


def test_a_namesake_can_be_registered_once_reception_has_checked(db, client_as):
    client = client_as(Role.SECRETARY)
    client.post("/api/v1/patients", json=NEW_PATIENT)

    response = client.post("/api/v1/patients", json={**NEW_PATIENT, "allow_duplicate": True})

    assert response.status_code == 201


@pytest.mark.parametrize("birth_date", ["1899-12-31", "2999-01-01"])
def test_impossible_birth_dates_are_refused(db, client_as, birth_date):
    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "birth_date": birth_date}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("phone", ["12", "call me", "0" * 16])
def test_impossible_phone_numbers_are_refused(db, client_as, phone):
    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "phone": phone}
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("06 12 34 56 78", "0612345678"),
        ("+33 6.12.34.56.78", "0612345678"),
        ("0033 6 12 34 56 78", "0612345678"),
        ("+41 22 123 45 67", "+41221234567"),
        ("", None),
    ],
)
def test_phone_numbers_are_stored_in_one_form(db, client_as, typed, stored):
    response = client_as(Role.SECRETARY).post(
        "/api/v1/patients", json={**NEW_PATIENT, "phone": typed}
    )

    assert response.json()["phone"] == stored


def test_reception_finds_a_caller_by_part_of_their_phone_number(db, client_as):
    client = client_as(Role.SECRETARY)
    client.post("/api/v1/patients", json={**NEW_PATIENT, "phone": "06 12 34 56 78"})
    add_patient(db)

    by_digits = client.get("/api/v1/patients", params={"search": "34 56"}).json()
    by_name = client.get("/api/v1/patients", params={"search": "Cam"}).json()

    assert [p["first_name"] for p in by_digits] == ["Camille"]
    assert [p["first_name"] for p in by_name] == ["Camille"]


def test_reception_corrects_a_misspelt_name_and_birth_date(db, client_as):
    patient = add_patient(db)

    response = client_as(Role.SECRETARY).patch(
        f"/api/v1/patients/{patient.id}",
        json={"last_name": "Synthétique", "birth_date": "1975-05-06"},
    )

    assert response.json()["last_name"] == "Synthétique"
    assert response.json()["birth_date"] == "1975-05-06"
    assert response.json()["first_name"] == "Alex"


def test_a_name_cannot_be_erased(db, client_as):
    patient = add_patient(db)

    response = client_as(Role.SECRETARY).patch(
        f"/api/v1/patients/{patient.id}", json={"last_name": None, "phone": None}
    )

    assert response.json()["last_name"] == "Synthetic"
    assert response.json()["phone"] is None


@pytest.mark.parametrize("search", ["06 12", "+33 6 12", "0033612"])
def test_a_french_number_is_found_however_it_is_typed(db, client_as, search):
    client = client_as(Role.SECRETARY)
    client.post("/api/v1/patients", json={**NEW_PATIENT, "phone": "+33 6 12 34 56 78"})

    body = client.get("/api/v1/patients", params={"search": search}).json()

    assert [p["phone"] for p in body] == ["0612345678"]


def test_a_namesake_is_caught_whatever_the_accents_and_case(db, client_as):
    client = client_as(Role.SECRETARY)
    client.post("/api/v1/patients", json={**NEW_PATIENT, "first_name": "Élodie"})

    response = client.post("/api/v1/patients", json={**NEW_PATIENT, "first_name": "ELODIE"})

    assert response.status_code == 409


def test_sending_no_login_unlinks_the_patients_account(db, client_as):
    account = add_account(db, Role.PATIENT)
    patient = add_patient(db, user_id=account.id)

    response = client_as(Role.SECRETARY).patch(
        f"/api/v1/patients/{patient.id}", json={"user_id": None}
    )

    assert response.json()["user_id"] is None
