"""Notifications: who hears about what, and each user sees only their own. Synthetic data."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.identity_access.service import Role
from app.modules.notifications import service
from app.modules.notifications.models import Notification, Status, Template
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.models import AppointmentStatus
from tests.scheduling.test_scheduling import (
    add_account,
    add_appointment,
    add_patient,
    assign,
    booking,
)

NEXT_YEAR = datetime.now(UTC).replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(
    days=365
)


def inbox_of(db: Session, user_id: uuid.UUID) -> list[Notification]:
    return list(db.scalars(select(Notification).where(Notification.recipient_id == user_id)))


def test_patient_and_practitioner_hear_about_a_booking_made_by_the_coordinator(db, client_as):
    coordinator = add_account(db, Role.COORDINATOR)
    practitioner = add_account(db, Role.PROFESSIONAL)
    patient_account = add_account(db, Role.PATIENT)
    patient = add_patient(db, patient_account.id)
    assign(db, practitioner.id, patient.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        "/api/v1/scheduling/appointments", json=booking(patient, practitioner, NEXT_YEAR)
    )

    assert response.status_code == 201
    for recipient in (patient_account, practitioner):
        [notification] = inbox_of(db, recipient.id)
        assert notification.template == Template.APPOINTMENT_BOOKED
        assert notification.params["professional_name"] == "Jordan Praticien"
    assert inbox_of(db, coordinator.id) == []


def test_a_notification_never_carries_the_patients_name(db, client_as):
    practitioner = add_account(db, Role.PROFESSIONAL)
    patient_account = add_account(db, Role.PATIENT)
    patient = add_patient(db, patient_account.id)
    assign(db, practitioner.id, patient.id)

    client_as(Role.SECRETARY).post(
        "/api/v1/scheduling/appointments", json=booking(patient, practitioner, NEXT_YEAR)
    )

    for notification in db.scalars(select(Notification)):
        assert "Synthetic" not in str(notification.params)


def test_practitioner_who_books_their_own_session_is_not_notified(db, client_as):
    practitioner = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)
    assign(db, practitioner.id, patient.id)

    client_as(Role.PROFESSIONAL, practitioner.id).post(
        "/api/v1/scheduling/appointments", json=booking(patient, practitioner, NEXT_YEAR)
    )

    assert inbox_of(db, practitioner.id) == []


def test_practitioner_is_asked_to_follow_up_a_no_show(db, client_as):
    practitioner = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)
    started = datetime.now(UTC) - timedelta(minutes=30)
    appointment = add_appointment(db, patient.id, practitioner.id, started)

    response = client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "no_show"}
    )

    assert response.status_code == 200
    [notification] = inbox_of(db, practitioner.id)
    assert notification.template == Template.MISSED_APPOINTMENT
    assert notification.subject_id == patient.id


def test_reminders_go_out_once_for_the_next_day(db):
    practitioner = add_account(db, Role.PROFESSIONAL)
    patient_account = add_account(db, Role.PATIENT)
    patient = add_patient(db, patient_account.id)
    now = datetime(2030, 1, 9, 12, tzinfo=UTC)
    tomorrow = add_appointment(db, patient.id, practitioner.id, now + timedelta(hours=20))
    add_appointment(db, patient.id, practitioner.id, now + timedelta(days=3))
    add_appointment(
        db, patient.id, practitioner.id, now + timedelta(hours=2), AppointmentStatus.CANCELLED
    )

    first = scheduling.send_appointment_reminders(db, now)
    second = scheduling.send_appointment_reminders(db, now)

    assert (first, second) == (1, 0)
    [reminder] = inbox_of(db, patient_account.id)
    assert reminder.template == Template.APPOINTMENT_REMINDER
    assert reminder.subject_id == tomorrow.id


def test_user_sees_only_their_own_notifications_newest_first(db, client_as):
    me, someone_else = uuid.uuid4(), uuid.uuid4()
    service.notify(db, [me], Template.APPOINTMENT_BOOKED)
    service.notify(db, [me], Template.APPOINTMENT_CANCELLED)
    service.notify(db, [someone_else], Template.APPOINTMENT_MOVED)
    db.commit()

    body = client_as(Role.PATIENT, me).get("/api/v1/notifications").json()

    assert body["unread"] == 2
    assert {n["template"] for n in body["items"]} == {"appointment_booked", "appointment_cancelled"}


def test_user_marks_one_or_all_notifications_read(db, client_as):
    me = uuid.uuid4()
    service.notify(db, [me], Template.APPOINTMENT_BOOKED)
    service.notify(db, [me], Template.APPOINTMENT_MOVED)
    db.commit()
    first, _ = inbox_of(db, me)
    client = client_as(Role.PROFESSIONAL, me)

    one = client.post(f"/api/v1/notifications/{first.id}/read")
    after_one = client.get("/api/v1/notifications").json()["unread"]
    everything = client.post("/api/v1/notifications/read")

    assert one.status_code == 200 and one.json()["status"] == "read"
    assert after_one == 1
    assert everything.status_code == 204
    db.expire_all()
    assert {n.status for n in inbox_of(db, me)} == {Status.READ}


def test_user_cannot_mark_someone_elses_notification(db, client_as):
    service.notify(db, [uuid.uuid4()], Template.APPOINTMENT_BOOKED)
    db.commit()
    [notification] = db.scalars(select(Notification))

    response = client_as(Role.ADMIN).post(f"/api/v1/notifications/{notification.id}/read")

    assert response.status_code == 404
    assert notification.status == Status.UNREAD
