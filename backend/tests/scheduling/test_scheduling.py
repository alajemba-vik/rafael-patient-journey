"""Appointment rules: who books, cancels and sees appointments; no overlaps. Synthetic data."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.errors import ConflictError
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.patients.models import Patient
from app.modules.scheduling import service
from app.modules.scheduling.models import Appointment, AppointmentStatus

NINE = datetime(2030, 1, 10, 9, tzinfo=UTC)
HOUR = timedelta(hours=1)


def add_account(db: Session, role: Role, full_name: str = "Jordan Praticien") -> User:
    account = User(
        auth_subject=str(uuid.uuid4()),
        email=f"{uuid.uuid4().hex}@example.com",
        full_name=full_name,
        role=role,
    )
    db.add(account)
    db.commit()
    return account


def add_patient(db: Session, user_id: uuid.UUID | None = None) -> Patient:
    patient = Patient(
        first_name="Alex", last_name="Synthetic", birth_date=datetime(1975, 5, 5).date()
    )
    patient.user_id = user_id
    db.add(patient)
    db.commit()
    return patient


def assign(db: Session, professional_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    db.add(CareAssignment(professional_id=professional_id, patient_id=patient_id))
    db.commit()


def add_appointment(
    db: Session,
    patient_id: uuid.UUID,
    professional_id: uuid.UUID,
    starts_at: datetime = NINE,
    status: AppointmentStatus = AppointmentStatus.SCHEDULED,
) -> Appointment:
    appointment = Appointment(
        patient_id=patient_id,
        professional_id=professional_id,
        starts_at=starts_at,
        ends_at=starts_at + HOUR,
        status=status,
        created_by=uuid.uuid4(),
    )
    db.add(appointment)
    db.commit()
    return appointment


def booking(patient: Patient, professional: User, starts_at: datetime = NINE) -> dict:
    return {
        "patient_id": str(patient.id),
        "professional_id": str(professional.id),
        "starts_at": starts_at.isoformat(),
        "ends_at": (starts_at + HOUR).isoformat(),
    }


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


@pytest.fixture
def team(db: Session) -> tuple[Patient, User]:
    """A patient followed by one practitioner."""
    patient = add_patient(db)
    professional = add_account(db, Role.PROFESSIONAL)
    assign(db, professional.id, patient.id)
    return patient, professional


# --- book -----------------------------------------------------------------


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.SECRETARY])
def test_coordinator_or_secretary_books_and_it_is_audited(db, client_as, team, role):
    patient, professional = team

    response = client_as(role).post("/api/v1/scheduling/appointments", json=booking(*team))

    assert response.status_code == 201
    assert response.json()["patient_name"] == "Alex Synthetic"
    assert response.json()["professional_name"] == "Jordan Praticien"
    assert response.json()["status"] == "scheduled"
    assert audit_actions(db) == ["appointment.create"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_book_and_it_is_audited(db, client_as, team, role):
    response = client_as(role).post("/api/v1/scheduling/appointments", json=booking(*team))

    assert response.status_code == 403
    assert audit_actions(db) == ["appointment.create.denied"]


def test_practitioner_outside_care_team_cannot_be_booked(db, client_as, team):
    patient, _ = team
    outsider = add_account(db, Role.PROFESSIONAL)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/scheduling/appointments", json=booking(patient, outsider)
    )

    assert response.status_code == 409


def test_practitioner_cannot_be_double_booked(db, client_as, team):
    patient, professional = team
    other_patient = add_patient(db)
    assign(db, professional.id, other_patient.id)
    add_appointment(db, other_patient.id, professional.id, NINE)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional, NINE + HOUR / 2)
    )

    assert response.status_code == 409


def test_patient_cannot_be_double_booked(db, client_as, team):
    patient, professional = team
    other = add_account(db, Role.COORDINATOR)
    assign(db, other.id, patient.id)
    add_appointment(db, patient.id, other.id, NINE)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional, NINE)
    )

    assert response.status_code == 409


def test_back_to_back_and_cancelled_slots_are_free(db, client_as, team):
    patient, professional = team
    add_appointment(db, patient.id, professional.id, NINE - HOUR)
    add_appointment(db, patient.id, professional.id, NINE, AppointmentStatus.CANCELLED)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional, NINE)
    )

    assert response.status_code == 201


def test_appointment_must_end_after_it_starts(db, client_as, team):
    body = {**booking(*team), "ends_at": NINE.isoformat()}

    response = client_as(Role.COORDINATOR).post("/api/v1/scheduling/appointments", json=body)

    assert response.status_code == 422


def test_unknown_patient_cannot_be_booked(db, client_as, team):
    _, professional = team
    ghost = uuid.uuid4()
    assign(db, professional.id, ghost)
    body = {**booking(*team), "patient_id": str(ghost)}

    response = client_as(Role.COORDINATOR).post("/api/v1/scheduling/appointments", json=body)

    assert response.status_code == 404


def test_database_refuses_an_appointment_ending_before_it_starts(db, team):
    patient, professional = team
    db.add(
        Appointment(
            patient_id=patient.id,
            professional_id=professional.id,
            starts_at=NINE,
            ends_at=NINE - HOUR,
            created_by=uuid.uuid4(),
        )
    )

    with pytest.raises(IntegrityError):
        db.commit()


# --- cancel ---------------------------------------------------------------


def test_secretary_cancels_and_it_is_audited(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/cancel"
    )

    assert response.json()["status"] == "cancelled"
    assert audit_actions(db) == ["appointment.cancel"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_cancel(db, client_as, team, role):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(role).post(f"/api/v1/scheduling/appointments/{appointment.id}/cancel")

    assert response.status_code == 403
    assert audit_actions(db) == ["appointment.cancel.denied"]


def test_only_scheduled_appointments_can_be_cancelled(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id, status=AppointmentStatus.DONE)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/cancel"
    )

    assert response.status_code == 409


# --- my appointments ------------------------------------------------------


def window() -> dict:
    return {"start": (NINE - HOUR * 24).isoformat(), "end": (NINE + HOUR * 24).isoformat()}


def test_patient_sees_only_own_appointments(db, client_as, team):
    patient_account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient, professional = team
    patient.user_id = patient_account.id
    db.commit()
    other_patient = add_patient(db)
    mine = add_appointment(db, patient.id, professional.id, NINE)
    add_appointment(db, other_patient.id, professional.id, NINE + HOUR)

    body = (
        client_as(Role.PATIENT, patient_account.id)
        .get("/api/v1/scheduling/appointments/mine", params=window())
        .json()
    )

    assert [a["id"] for a in body] == [str(mine.id)]


def test_practitioner_sees_own_schedule_and_it_is_audited(db, client_as, team):
    patient, professional = team
    colleague = add_account(db, Role.PROFESSIONAL)
    mine = add_appointment(db, patient.id, professional.id, NINE)
    add_appointment(db, patient.id, colleague.id, NINE + HOUR)

    body = (
        client_as(Role.PROFESSIONAL, professional.id)
        .get("/api/v1/scheduling/appointments/mine", params=window())
        .json()
    )

    assert [a["id"] for a in body] == [str(mine.id)]
    assert audit_actions(db) == ["appointment.list"]


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.ADMIN])
def test_office_roles_have_no_personal_schedule(db, client_as, role):
    response = client_as(role).get("/api/v1/scheduling/appointments/mine")

    assert response.status_code == 403


# --- a patient's appointments ---------------------------------------------


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.PROFESSIONAL])
def test_secretary_and_care_team_see_patient_appointments(db, client_as, team, role):
    patient, professional = team
    add_appointment(db, patient.id, professional.id)
    user_id = professional.id if role == Role.PROFESSIONAL else None

    response = client_as(role, user_id).get(
        f"/api/v1/scheduling/patients/{patient.id}/appointments"
    )

    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.COORDINATOR, Role.PATIENT, Role.ADMIN])
def test_outsiders_cannot_see_patient_appointments_and_it_is_audited(db, client_as, team, role):
    patient, _ = team

    response = client_as(role).get(f"/api/v1/scheduling/patients/{patient.id}/appointments")

    assert response.status_code == 403
    assert audit_actions(db) == ["appointment.list.denied"]


# --- status lifecycle -----------------------------------------------------


def test_status_follows_the_lifecycle(db, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    service.set_status(db, appointment.id, AppointmentStatus.ARRIVED)
    service.set_status(db, appointment.id, AppointmentStatus.DONE)

    assert appointment.status == AppointmentStatus.DONE


def test_status_cannot_skip_arrival(db, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    with pytest.raises(ConflictError):
        service.set_status(db, appointment.id, AppointmentStatus.DONE)
