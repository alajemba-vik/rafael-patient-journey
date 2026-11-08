"""Reception board rules: secretaries see today's appointments and record arrivals."""

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.patients.models import Patient
from app.modules.scheduling.models import Appointment, AppointmentStatus
from app.modules.scheduling.service import day_window

OTHER_ROLES = [Role.PATIENT, Role.PROFESSIONAL, Role.COORDINATOR, Role.ADMIN]


def add_patient(db: Session) -> Patient:
    patient = Patient(
        first_name="Alex", last_name="Synthetic", birth_date=datetime(1975, 5, 5).date()
    )
    db.add(patient)
    db.commit()
    return patient


def add_appointment(
    db: Session,
    starts_at: datetime,
    status: AppointmentStatus = AppointmentStatus.SCHEDULED,
) -> Appointment:
    appointment = Appointment(
        patient_id=add_patient(db).id,
        professional_id=uuid.uuid4(),
        starts_at=starts_at,
        ends_at=starts_at + timedelta(minutes=45),
        status=status,
        created_by=uuid.uuid4(),
    )
    db.add(appointment)
    db.commit()
    return appointment


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


# --- today's board --------------------------------------------------------


def test_secretary_sees_todays_appointments_and_each_patient_is_audited(db, client_as):
    now = datetime.now(UTC)
    today = add_appointment(db, now)
    add_appointment(db, now + timedelta(days=1))
    add_appointment(db, now, AppointmentStatus.CANCELLED)

    body = client_as(Role.SECRETARY).get("/api/v1/reception/today").json()

    assert [a["id"] for a in body] == [str(today.id)]
    assert body[0]["patient_name"] == "Alex Synthetic"
    assert audit_actions(db) == ["reception.read"]


@pytest.mark.parametrize("role", OTHER_ROLES)
def test_other_roles_cannot_see_the_board_and_it_is_audited(db, client_as, role):
    response = client_as(role).get("/api/v1/reception/today")

    assert response.status_code == 403
    assert audit_actions(db) == ["reception.denied"]


# --- arrivals -------------------------------------------------------------


def test_secretary_records_arrival_then_end_and_it_is_audited(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/reception/appointments/{appointment.id}/status"

    arrived = client.post(url, json={"status": "arrived"})
    done = client.post(url, json={"status": "done"})

    assert arrived.json()["status"] == "arrived"
    assert done.json()["status"] == "done"
    assert audit_actions(db) == ["appointment.arrived", "appointment.done"]


def test_secretary_can_undo_a_mistaken_no_show(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC), AppointmentStatus.NO_SHOW)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "scheduled"}
    )

    assert response.json()["status"] == "scheduled"


def test_cancelling_is_not_a_reception_status(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "cancelled"}
    )

    assert response.status_code == 409


@pytest.mark.parametrize("role", OTHER_ROLES)
def test_other_roles_cannot_record_arrivals(db, client_as, role):
    appointment = add_appointment(db, datetime.now(UTC))

    response = client_as(role).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "arrived"}
    )

    assert response.status_code == 403
    assert db.get(Appointment, appointment.id).status == AppointmentStatus.SCHEDULED


# --- the Institute's day --------------------------------------------------

PARIS = ZoneInfo("Europe/Paris")


@pytest.mark.parametrize(
    ("day", "hours"),
    [(date(2026, 10, 21), 24), (date(2026, 10, 25), 25), (date(2027, 3, 28), 23)],
)
def test_the_day_runs_from_local_midnight_to_local_midnight(day, hours):
    start, end = day_window(day, PARIS)

    assert start.astimezone(PARIS).hour == 0
    assert end.astimezone(PARIS).hour == 0
    assert end - start == timedelta(hours=hours)


# --- any day's board ------------------------------------------------------


def test_secretary_sees_a_days_board_with_cancelled_appointments(db, client_as):
    tomorrow = datetime.now(PARIS).date() + timedelta(days=1)
    noon = datetime.combine(tomorrow, datetime.min.time(), tzinfo=PARIS) + timedelta(hours=12)
    kept = add_appointment(db, noon.astimezone(UTC))
    cancelled = add_appointment(db, noon.astimezone(UTC), AppointmentStatus.CANCELLED)
    add_appointment(db, datetime.now(UTC))

    response = client_as(Role.SECRETARY).get(
        "/api/v1/reception/day", params={"day": tomorrow.isoformat()}
    )

    assert {a["id"] for a in response.json()} == {str(kept.id), str(cancelled.id)}
    assert audit_actions(db) == ["reception.read", "reception.read"]


def test_the_days_board_defaults_to_today(db, client_as):
    today = add_appointment(db, datetime.now(UTC))

    body = client_as(Role.SECRETARY).get("/api/v1/reception/day").json()

    assert [a["id"] for a in body] == [str(today.id)]


@pytest.mark.parametrize("role", OTHER_ROLES)
def test_other_roles_cannot_see_a_days_board(db, client_as, role):
    response = client_as(role).get("/api/v1/reception/day")

    assert response.status_code == 403
    assert audit_actions(db) == ["reception.denied"]


# --- the waiting room -----------------------------------------------------


def test_the_waiting_room_records_arrival_and_call_in_times(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/reception/appointments/{appointment.id}/status"

    arrived = client.post(url, json={"status": "arrived"}).json()
    called_in = client.post(url, json={"status": "in_session"}).json()
    done = client.post(url, json={"status": "done"}).json()

    assert arrived["arrived_at"] is not None and arrived["called_in_at"] is None
    assert called_in["status"] == "in_session"
    assert called_in["called_in_at"] is not None
    assert called_in["arrived_at"] == arrived["arrived_at"]
    assert done["status"] == "done"
    assert audit_actions(db) == [
        "appointment.arrived",
        "appointment.in_session",
        "appointment.done",
    ]


def test_sending_a_patient_back_to_the_waiting_room_keeps_their_arrival_time(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/reception/appointments/{appointment.id}/status"
    arrived = client.post(url, json={"status": "arrived"}).json()
    client.post(url, json={"status": "in_session"})

    back = client.post(url, json={"status": "arrived"}).json()

    assert back["status"] == "arrived"
    assert back["arrived_at"] == arrived["arrived_at"]
    assert back["called_in_at"] is None


def test_undoing_an_arrival_clears_the_waiting_room_times(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/reception/appointments/{appointment.id}/status"
    client.post(url, json={"status": "arrived"})

    undone = client.post(url, json={"status": "scheduled"}).json()

    assert undone["status"] == "scheduled"
    assert undone["arrived_at"] is None


def test_a_patient_must_be_in_the_waiting_room_before_being_called_in(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC))

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "in_session"}
    )

    assert response.status_code == 409


def test_nothing_is_recorded_for_a_later_day(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC) + timedelta(days=2))

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "arrived"}
    )

    assert response.status_code == 409


def test_a_forgotten_no_show_can_be_recorded_the_next_day(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC) - timedelta(days=1))

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "no_show"}
    )

    assert response.json()["status"] == "no_show"


def test_a_forgotten_session_is_closed_as_done_the_next_day(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC) - timedelta(days=1))

    body = (
        client_as(Role.SECRETARY)
        .post(f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "done"})
        .json()
    )

    assert body["status"] == "done"
    assert body["arrived_at"] is None


def test_a_past_day_cannot_record_an_arrival(db, client_as):
    appointment = add_appointment(db, datetime.now(UTC) - timedelta(days=1))

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "arrived"}
    )

    assert response.status_code == 409


def test_a_board_for_a_day_outside_the_agenda_is_refused(db, client_as):
    response = client_as(Role.SECRETARY).get("/api/v1/reception/day", params={"day": "0001-01-01"})

    assert response.status_code == 400
