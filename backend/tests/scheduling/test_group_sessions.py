"""Group sessions: planned by staff, filled up to capacity, attendance recorded.

All data is synthetic.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.notifications.models import Notification, Template
from app.modules.scheduling.models import GroupEnrollment, GroupSession
from tests.scheduling.test_scheduling import (
    HOUR,
    add_account,
    add_appointment,
    add_patient,
    assign,
    booking,
)

FUTURE = datetime(2030, 1, 10, 9, tzinfo=UTC)


def session_body(professional_id, starts_at=FUTURE, capacity=12) -> dict:
    return {
        "professional_id": str(professional_id),
        "title": "Activité physique adaptée",
        "starts_at": starts_at.isoformat(),
        "ends_at": (starts_at + HOUR).isoformat(),
        "capacity": capacity,
    }


def add_session(db, professional_id, starts_at=FUTURE, capacity=12) -> GroupSession:
    session = GroupSession(
        professional_id=professional_id,
        title="Pilates",
        starts_at=starts_at,
        ends_at=starts_at + HOUR,
        capacity=capacity,
        created_by=professional_id,
    )
    db.add(session)
    db.commit()
    return session


def audit_actions(db) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.COORDINATOR])
def test_reception_and_coordinators_plan_a_group_session(db, client_as, role):
    coach = add_account(db, Role.PROFESSIONAL, "Jordan Coach")

    response = client_as(role).post(
        "/api/v1/scheduling/group-sessions", json=session_body(coach.id)
    )

    assert response.status_code == 201
    assert response.json()["professional_name"] == "Jordan Coach"
    assert (response.json()["capacity"], response.json()["enrolled"]) == (12, 0)
    assert "group_session.create" in audit_actions(db)


def test_a_practitioner_plans_their_own_sessions_but_not_someone_elses(db, client_as):
    coach, colleague = add_account(db, Role.PROFESSIONAL), add_account(db, Role.PROFESSIONAL)
    client = client_as(Role.PROFESSIONAL, coach.id)

    own = client.post("/api/v1/scheduling/group-sessions", json=session_body(coach.id))
    other = client.post("/api/v1/scheduling/group-sessions", json=session_body(colleague.id))

    assert (own.status_code, other.status_code) == (201, 403)


@pytest.mark.parametrize("role", [Role.PATIENT, Role.ADMIN])
def test_patients_and_admins_cannot_plan_group_sessions(db, client_as, role):
    coach = add_account(db, Role.PROFESSIONAL)

    response = client_as(role).post(
        "/api/v1/scheduling/group-sessions", json=session_body(coach.id)
    )

    assert response.status_code == 403


def test_a_group_session_cannot_clash_with_the_practitioners_appointments(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    add_appointment(db, add_patient(db).id, coach.id, FUTURE)

    response = client_as(Role.SECRETARY).post(
        "/api/v1/scheduling/group-sessions", json=session_body(coach.id)
    )

    assert response.status_code == 409


def test_an_appointment_cannot_clash_with_the_practitioners_group_session(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)
    assign(db, coach.id, patient.id)
    add_session(db, coach.id)

    response = client_as(Role.SECRETARY).post(
        "/api/v1/scheduling/appointments", json=booking(patient, coach, FUTURE)
    )

    assert response.status_code == 409


def test_enrolling_fills_places_up_to_capacity_and_tells_the_patient(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    session = add_session(db, coach.id, capacity=2)
    patient_account = add_account(db, Role.PATIENT)
    first, second, third = add_patient(db, patient_account.id), add_patient(db), add_patient(db)
    client = client_as(Role.SECRETARY)
    url = f"/api/v1/scheduling/group-sessions/{session.id}/enrollments"

    one = client.post(url, json={"patient_id": str(first.id)})
    twice = client.post(url, json={"patient_id": str(first.id)})
    two = client.post(url, json={"patient_id": str(second.id)})
    full = client.post(url, json={"patient_id": str(third.id)})

    assert one.status_code == 200 and two.status_code == 200
    assert (twice.status_code, full.status_code) == (409, 409)
    assert two.json()["enrolled"] == 2
    assert {p["patient_name"] for p in two.json()["participants"]} == {"Alex Synthetic"}
    notified = db.scalars(
        select(Notification.template).where(Notification.recipient_id == patient_account.id)
    )
    assert list(notified) == [Template.APPOINTMENT_BOOKED]
    assert "group_session.enroll" in audit_actions(db)


def test_a_place_can_be_given_back(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    session = add_session(db, coach.id)
    patient = add_patient(db)
    db.add(GroupEnrollment(session_id=session.id, patient_id=patient.id, enrolled_at=FUTURE))
    db.commit()

    response = client_as(Role.PROFESSIONAL, coach.id).delete(
        f"/api/v1/scheduling/group-sessions/{session.id}/enrollments/{patient.id}"
    )

    assert response.status_code == 200
    assert response.json()["enrolled"] == 0


def test_attendance_is_recorded_once_the_session_has_begun(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)
    started = add_session(db, coach.id, starts_at=datetime.now(UTC) - timedelta(minutes=30))
    upcoming = add_session(db, coach.id, starts_at=FUTURE)
    for session in (started, upcoming):
        db.add(GroupEnrollment(session_id=session.id, patient_id=patient.id, enrolled_at=FUTURE))
    db.commit()
    client = client_as(Role.PROFESSIONAL, coach.id)
    path = "/api/v1/scheduling/group-sessions/{}/enrollments/{}/attendance"

    done = client.post(path.format(started.id, patient.id), json={"status": "attended"})
    early = client.post(path.format(upcoming.id, patient.id), json={"status": "attended"})

    assert done.status_code == 200
    assert done.json()["participants"][0]["status"] == "attended"
    assert early.status_code == 409


def test_another_practitioner_cannot_manage_or_read_the_session(db, client_as):
    coach, colleague = add_account(db, Role.PROFESSIONAL), add_account(db, Role.PROFESSIONAL)
    session = add_session(db, coach.id)
    client = client_as(Role.PROFESSIONAL, colleague.id)

    read = client.get(f"/api/v1/scheduling/group-sessions/{session.id}")
    enroll = client.post(
        f"/api/v1/scheduling/group-sessions/{session.id}/enrollments",
        json={"patient_id": str(add_patient(db).id)},
    )

    assert (read.status_code, enroll.status_code) == (403, 403)
    assert "group_session.read.denied" in audit_actions(db)


def test_cancelling_tells_every_enrolled_patient(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    session = add_session(db, coach.id)
    accounts = [add_account(db, Role.PATIENT) for _ in range(2)]
    for account in accounts:
        patient = add_patient(db, account.id)
        db.add(GroupEnrollment(session_id=session.id, patient_id=patient.id, enrolled_at=FUTURE))
    db.commit()

    response = client_as(Role.COORDINATOR).post(
        f"/api/v1/scheduling/group-sessions/{session.id}/cancel"
    )

    assert response.json()["status"] == "cancelled"
    templates = db.scalars(
        select(Notification.template).where(Notification.recipient_id.in_([a.id for a in accounts]))
    )
    assert list(templates) == [Template.APPOINTMENT_CANCELLED] * 2


def test_lists_show_how_full_sessions_are_and_patients_see_their_own(db, client_as):
    coach = add_account(db, Role.PROFESSIONAL)
    patient_account = add_account(db, Role.PATIENT)
    patient = add_patient(db, patient_account.id)
    mine = add_session(db, coach.id, starts_at=FUTURE)
    add_session(db, coach.id, starts_at=FUTURE + timedelta(days=1))
    db.add(GroupEnrollment(session_id=mine.id, patient_id=patient.id, enrolled_at=FUTURE))
    db.commit()
    window = {"start": "2030-01-01T00:00:00Z", "end": "2030-02-01T00:00:00Z"}

    staff = client_as(Role.SECRETARY).get("/api/v1/scheduling/group-sessions", params=window)
    own = client_as(Role.PATIENT, patient_account.id).get("/api/v1/scheduling/group-sessions/mine")

    assert [s["enrolled"] for s in staff.json()] == [1, 0]
    assert [s["id"] for s in own.json()] == [str(mine.id)]
