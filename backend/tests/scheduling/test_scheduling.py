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
    appointment = add_appointment(db, patient.id, professional.id, datetime.now(UTC))

    service.set_status(db, appointment.id, AppointmentStatus.ARRIVED)
    service.set_status(db, appointment.id, AppointmentStatus.DONE)

    assert appointment.status == AppointmentStatus.DONE


def test_status_cannot_skip_arrival_today(db, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id, datetime.now(UTC))

    with pytest.raises(ConflictError):
        service.set_status(db, appointment.id, AppointmentStatus.DONE)


# --- reschedule -----------------------------------------------------------


def reschedule_to(starts_at: datetime) -> dict:
    return {"starts_at": starts_at.isoformat(), "ends_at": (starts_at + HOUR).isoformat()}


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.SECRETARY])
def test_booking_roles_move_an_appointment_and_it_is_audited(db, client_as, team, role):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(role).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/reschedule",
        json=reschedule_to(NINE + 3 * HOUR),
    )

    assert response.status_code == 200
    assert datetime.fromisoformat(response.json()["starts_at"]) == NINE + 3 * HOUR
    assert response.json()["status"] == "scheduled"
    assert audit_actions(db) == ["appointment.reschedule"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_move_an_appointment_and_it_is_audited(db, client_as, team, role):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(role).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/reschedule",
        json=reschedule_to(NINE + 3 * HOUR),
    )

    assert response.status_code == 403
    assert audit_actions(db) == ["appointment.reschedule.denied"]
    assert db.get(Appointment, appointment.id).starts_at.replace(tzinfo=UTC) == NINE


def test_an_appointment_can_move_into_its_own_old_slot_but_not_onto_another(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id, NINE)
    add_appointment(db, patient.id, professional.id, NINE + 2 * HOUR)
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/scheduling/appointments/{appointment.id}/reschedule"

    later_in_own_slot = client.post(url, json=reschedule_to(NINE + HOUR / 2))
    onto_other = client.post(url, json=reschedule_to(NINE + 2 * HOUR))

    assert later_in_own_slot.status_code == 200
    assert onto_other.status_code == 409


@pytest.mark.parametrize("status", [AppointmentStatus.ARRIVED, AppointmentStatus.CANCELLED])
def test_only_scheduled_appointments_can_move(db, client_as, team, status):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id, status=status)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/reschedule",
        json=reschedule_to(NINE + 3 * HOUR),
    )

    assert response.status_code == 409


def test_nothing_is_booked_or_moved_onto_a_past_day(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)
    yesterday = datetime.now(UTC) - timedelta(days=1)
    client = client_as(Role.SECRETARY)

    booked = client.post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional, yesterday)
    )
    moved = client.post(
        f"/api/v1/scheduling/appointments/{appointment.id}/reschedule",
        json=reschedule_to(yesterday),
    )

    assert booked.status_code == 400
    assert moved.status_code == 400


# --- cancel with a reason, notes ------------------------------------------


def test_cancelling_records_the_reason_and_when(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/cancel",
        json={"reason": "patient_request"},
    )

    assert response.json()["status"] == "cancelled"
    assert response.json()["cancel_reason"] == "patient_request"
    db.expire_all()  # the API wrote through its own session
    assert db.get(Appointment, appointment.id).cancelled_at is not None


def test_cancelling_without_a_reason_records_other(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/cancel"
    )

    assert response.json()["cancel_reason"] == "other"


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.SECRETARY])
def test_booking_roles_write_and_clear_a_note_and_it_is_audited(db, client_as, team, role):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)
    client = client_as(role)
    url = f"/api/v1/scheduling/appointments/{appointment.id}"

    written = client.patch(url, json={"note": "  Prévient d’un retard de 10 min  "})
    cleared = client.patch(url, json={"note": ""})

    assert written.json()["note"] == "Prévient d’un retard de 10 min"
    assert cleared.json()["note"] is None
    assert audit_actions(db) == ["appointment.note", "appointment.note"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_write_a_note_and_it_is_audited(db, client_as, team, role):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(role).patch(
        f"/api/v1/scheduling/appointments/{appointment.id}", json={"note": "Synthetic"}
    )

    assert response.status_code == 403
    assert audit_actions(db) == ["appointment.note.denied"]


def test_notes_longer_than_a_short_message_are_refused(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.SECRETARY).patch(
        f"/api/v1/scheduling/appointments/{appointment.id}", json={"note": "x" * 281}
    )

    assert response.status_code == 422


def test_patients_never_see_staff_notes_but_their_care_team_does(db, client_as):
    account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, user_id=account.id)
    professional = add_account(db, Role.PROFESSIONAL)
    assign(db, professional.id, patient.id)
    appointment = add_appointment(db, patient.id, professional.id, datetime.now(UTC) + HOUR)
    appointment.note = "Vient accompagnée"
    db.commit()
    url = f"/api/v1/scheduling/patients/{patient.id}/appointments"

    as_patient = client_as(Role.PATIENT, account.id).get(url).json()
    own_list = client_as(Role.PATIENT, account.id).get("/api/v1/scheduling/appointments/mine")
    as_practitioner = client_as(Role.PROFESSIONAL, professional.id).get(url).json()

    assert as_patient[0]["note"] is None
    assert own_list.json()[0]["note"] is None
    assert as_practitioner[0]["note"] == "Vient accompagnée"


# --- availability ---------------------------------------------------------


def availability(client, professional: User, minutes: int = 60):
    return client.get(
        f"/api/v1/scheduling/professionals/{professional.id}/availability",
        params={"day": NINE.date().isoformat(), "minutes": minutes},
    )


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.SECRETARY])
def test_booking_roles_see_busy_and_free_times_without_patient_names(db, client_as, team, role):
    patient, professional = team
    add_appointment(db, patient.id, professional.id, NINE)  # 10:00–11:00 in Paris (winter)
    add_appointment(db, patient.id, professional.id, NINE + 3 * HOUR, AppointmentStatus.CANCELLED)

    body = availability(client_as(role), professional).json()

    assert body["busy"] == [
        {"starts_at": "2030-01-10T09:00:00Z", "ends_at": "2030-01-10T10:00:00Z"}
    ]
    free_starts = [slot["starts_at"] for slot in body["free"]]
    assert free_starts[0] == "2030-01-10T08:00:00Z"  # opening, 9:00 in Paris
    assert "2030-01-10T08:15:00Z" not in free_starts  # would run into the 10:00 session
    assert "2030-01-10T09:30:00Z" not in free_starts
    assert "2030-01-10T10:00:00Z" in free_starts  # the cancelled slot doesn't count
    assert free_starts[-1] == "2030-01-10T17:00:00Z"  # ends at closing, 19:00 in Paris
    assert "patient" not in str(body)


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_see_availability(db, client_as, team, role):
    _, professional = team

    response = availability(client_as(role), professional)

    assert response.status_code == 403


def test_availability_is_only_for_care_staff(db, client_as):
    secretary = add_account(db, Role.SECRETARY)

    response = availability(client_as(Role.COORDINATOR), secretary)

    assert response.status_code == 404


def test_free_slots_never_start_in_the_past(db, client_as, team):
    _, professional = team

    body = (
        client_as(Role.SECRETARY)
        .get(
            f"/api/v1/scheduling/professionals/{professional.id}/availability",
            params={"day": (datetime.now(UTC) - timedelta(days=1)).date().isoformat()},
        )
        .json()
    )

    assert body["free"] == []


def test_a_past_days_session_is_closed_as_done_without_inventing_times(db, team):
    patient, professional = team
    yesterday = datetime.now(UTC) - timedelta(days=1)
    appointment = add_appointment(db, patient.id, professional.id, yesterday)

    service.set_status(db, appointment.id, AppointmentStatus.DONE)

    assert appointment.status == AppointmentStatus.DONE
    assert appointment.arrived_at is None
    assert appointment.called_in_at is None


@pytest.mark.parametrize("status", [AppointmentStatus.ARRIVED, AppointmentStatus.IN_SESSION])
def test_a_past_day_has_no_waiting_room(db, team, status):
    patient, professional = team
    yesterday = datetime.now(UTC) - timedelta(days=1)
    appointment = add_appointment(db, patient.id, professional.id, yesterday)

    with pytest.raises(ConflictError):
        service.set_status(db, appointment.id, status)


def test_nobody_is_absent_before_their_session_starts(db, team):
    patient, professional = team
    soon = datetime.now(UTC) + timedelta(minutes=1)
    appointment = add_appointment(db, patient.id, professional.id, soon)

    with pytest.raises(ConflictError):
        service.set_status(db, appointment.id, AppointmentStatus.NO_SHOW)


@pytest.mark.parametrize("action", ["cancel", "reschedule"])
def test_a_past_days_appointment_can_no_longer_be_cancelled_or_moved(db, client_as, team, action):
    patient, professional = team
    yesterday = datetime.now(UTC) - timedelta(days=1)
    appointment = add_appointment(db, patient.id, professional.id, yesterday)
    tomorrow = datetime.now(UTC) + timedelta(days=1)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/{action}",
        json=reschedule_to(tomorrow) if action == "reschedule" else {},
    )

    assert response.status_code == 409


@pytest.mark.parametrize("action", ["cancel", "reschedule"])
def test_a_refused_role_cannot_tell_whether_an_appointment_exists(db, client_as, action):
    unknown = uuid.uuid4()

    response = client_as(Role.PATIENT).post(
        f"/api/v1/scheduling/appointments/{unknown}/{action}", json=reschedule_to(NINE)
    )

    assert response.status_code == 403


def test_free_slots_leave_out_the_patients_other_appointments(db, client_as, team):
    patient, professional = team
    other = add_account(db, Role.PROFESSIONAL, "Sam Autre")
    assign(db, other.id, patient.id)
    add_appointment(db, patient.id, other.id, NINE)  # 10:00 in Paris, with someone else

    body = (
        client_as(Role.SECRETARY)
        .get(
            f"/api/v1/scheduling/professionals/{professional.id}/availability",
            params={"day": NINE.date().isoformat(), "minutes": 60, "patient_id": str(patient.id)},
        )
        .json()
    )

    assert "2030-01-10T09:00:00Z" not in [slot["starts_at"] for slot in body["free"]]
    assert "appointment.availability" in audit_actions(db)


def test_free_slots_for_a_move_ignore_the_appointment_being_moved(db, client_as, team):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id, NINE)

    body = (
        client_as(Role.SECRETARY)
        .get(
            f"/api/v1/scheduling/professionals/{professional.id}/availability",
            params={
                "day": NINE.date().isoformat(),
                "minutes": 60,
                "ignore_id": str(appointment.id),
            },
        )
        .json()
    )

    assert "2030-01-10T09:15:00Z" in [slot["starts_at"] for slot in body["free"]]


def test_a_day_outside_the_agenda_is_refused_not_a_crash(db, client_as, team):
    _, professional = team

    response = client_as(Role.SECRETARY).get(
        f"/api/v1/scheduling/professionals/{professional.id}/availability",
        params={"day": "0001-01-01"},
    )

    assert response.status_code == 400


# --- a practitioner's own agenda -------------------------------------------


def test_a_practitioner_books_a_follow_up_with_their_own_patient(db, client_as, team):
    patient, professional = team

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional)
    )

    assert response.status_code == 201
    assert "appointment.create" in audit_actions(db)


def test_a_practitioner_cannot_book_for_a_colleague(db, client_as, team):
    patient, professional = team
    colleague = add_account(db, Role.PROFESSIONAL, "Sam Collègue")
    assign(db, colleague.id, patient.id)

    response = client_as(Role.PROFESSIONAL, colleague.id).post(
        "/api/v1/scheduling/appointments", json=booking(patient, professional)
    )

    assert response.status_code == 403
    assert "appointment.create.denied" in audit_actions(db)


def test_a_practitioner_cannot_book_a_patient_outside_their_care_team(db, client_as):
    outsider = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)

    response = client_as(Role.PROFESSIONAL, outsider.id).post(
        "/api/v1/scheduling/appointments", json=booking(patient, outsider)
    )

    assert response.status_code == 403
    assert "appointment.create.denied" in audit_actions(db)


@pytest.mark.parametrize("action", ["cancel", "reschedule"])
def test_a_practitioner_moves_or_cancels_their_own_session(db, client_as, team, action):
    patient, professional = team
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/{action}",
        json=reschedule_to(NINE + 3 * HOUR) if action == "reschedule" else {},
    )

    assert response.status_code == 200


@pytest.mark.parametrize("action", ["cancel", "reschedule"])
def test_a_practitioner_cannot_touch_a_colleagues_session(db, client_as, team, action):
    patient, professional = team
    colleague = add_account(db, Role.PROFESSIONAL, "Sam Collègue")
    appointment = add_appointment(db, patient.id, professional.id)

    response = client_as(Role.PROFESSIONAL, colleague.id).post(
        f"/api/v1/scheduling/appointments/{appointment.id}/{action}",
        json=reschedule_to(NINE + 3 * HOUR) if action == "reschedule" else {},
    )

    assert response.status_code == 403
    assert f"appointment.{action}.denied" in audit_actions(db)


def test_a_practitioner_sees_their_own_free_slots_only(db, client_as, team):
    _, professional = team
    colleague = add_account(db, Role.PROFESSIONAL, "Sam Collègue")
    client = client_as(Role.PROFESSIONAL, professional.id)
    day = {"day": NINE.date().isoformat()}

    own = client.get(f"/api/v1/scheduling/professionals/{professional.id}/availability", params=day)
    other = client.get(f"/api/v1/scheduling/professionals/{colleague.id}/availability", params=day)

    assert own.status_code == 200
    assert other.status_code == 403


def test_no_free_slots_are_suggested_at_the_weekend(db, client_as, team):
    _, professional = team
    saturday = "2030-01-12"

    body = (
        client_as(Role.SECRETARY)
        .get(
            f"/api/v1/scheduling/professionals/{professional.id}/availability",
            params={"day": saturday},
        )
        .json()
    )

    assert body["free"] == []
