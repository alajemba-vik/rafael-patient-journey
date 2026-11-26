"""Session evaluations: the patient and the practitioner each rate a finished session.

All data is synthetic.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.notifications.models import Notification, Template
from app.modules.scheduling.models import AppointmentStatus
from tests.scheduling.test_scheduling import add_account, add_appointment, add_patient, assign

YESTERDAY = datetime.now(UTC).replace(microsecond=0) - timedelta(days=1)
RATING = {"difficulty": 2, "satisfaction": 4}


def audit_actions(db) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


def setup_session(db, status=AppointmentStatus.DONE, starts_at=YESTERDAY):
    patient_account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, patient_account.id)
    coach = add_account(db, Role.PROFESSIONAL, "Jordan Coach")
    assign(db, coach.id, patient.id)
    appointment = add_appointment(db, patient.id, coach.id, starts_at, status)
    return patient_account, patient, coach, appointment


def test_patient_rates_a_finished_session_once(db, client_as):
    patient_account, _, _, appointment = setup_session(db)
    client = client_as(Role.PATIENT, patient_account.id)

    to_rate = client.get("/api/v1/questionnaires/sessions/to-rate").json()
    first = client.post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )
    second = client.post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )
    after = client.get("/api/v1/questionnaires/sessions/to-rate").json()

    assert [s["professional_name"] for s in to_rate] == ["Jordan Coach"]
    assert first.status_code == 200
    assert (first.json()["patient_difficulty"], first.json()["patient_satisfaction"]) == (2, 4)
    assert second.status_code == 409
    assert after == []
    assert "session_evaluation.patient" in audit_actions(db)


def test_a_session_not_finished_cannot_be_rated(db, client_as):
    patient_account, _, _, appointment = setup_session(db, AppointmentStatus.NO_SHOW)

    response = client_as(Role.PATIENT, patient_account.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )

    assert response.status_code == 409


def test_a_session_older_than_two_weeks_is_no_longer_offered_or_rated(db, client_as):
    long_ago = YESTERDAY - timedelta(days=20)
    patient_account, _, _, appointment = setup_session(db, starts_at=long_ago)
    client = client_as(Role.PATIENT, patient_account.id)

    to_rate = client.get("/api/v1/questionnaires/sessions/to-rate").json()
    response = client.post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )

    assert to_rate == []
    assert response.status_code == 409


def test_patient_cannot_rate_someone_elses_session_and_it_is_audited(db, client_as):
    _, _, _, appointment = setup_session(db)
    other_account = add_account(db, Role.PATIENT)
    add_patient(db, other_account.id)

    response = client_as(Role.PATIENT, other_account.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )

    assert response.status_code == 403
    assert "session_evaluation.rate.denied" in audit_actions(db)


def test_out_of_range_ratings_are_refused(db, client_as):
    patient_account, _, _, appointment = setup_session(db)

    response = client_as(Role.PATIENT, patient_account.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating",
        json={"difficulty": 5, "satisfaction": 2},
    )

    assert response.status_code == 422


def test_practitioner_who_led_the_session_records_coping_and_intensity(db, client_as):
    _, _, coach, appointment = setup_session(db)
    client = client_as(Role.PROFESSIONAL, coach.id)

    first = client.post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/practitioner-rating",
        json={"coping": 3, "intensity_mets": 5.5},
    )
    corrected = client.post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/practitioner-rating",
        json={"coping": 2},
    )

    assert first.status_code == 200
    assert (corrected.json()["coping"], corrected.json()["intensity_mets"]) == (2, None)
    assert "session_evaluation.practitioner" in audit_actions(db)


def test_another_team_member_cannot_rate_a_session_they_did_not_lead(db, client_as):
    _, patient, _, appointment = setup_session(db)
    colleague = add_account(db, Role.COORDINATOR)
    assign(db, colleague.id, patient.id)

    response = client_as(Role.COORDINATOR, colleague.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/practitioner-rating",
        json={"coping": 3},
    )

    assert response.status_code == 403


def test_care_team_sees_both_sides_of_every_session(db, client_as):
    patient_account, patient, coach, appointment = setup_session(db)
    client_as(Role.PATIENT, patient_account.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/patient-rating", json=RATING
    )
    client_as(Role.PROFESSIONAL, coach.id).post(
        f"/api/v1/questionnaires/sessions/{appointment.id}/practitioner-rating",
        json={"coping": 4},
    )

    [session] = (
        client_as(Role.PROFESSIONAL, coach.id)
        .get(f"/api/v1/questionnaires/patients/{patient.id}/sessions")
        .json()
    )

    assert (session["patient_satisfaction"], session["coping"]) == (4, 4)
    assert "session_evaluation.read" in audit_actions(db)


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.ADMIN, Role.PROFESSIONAL])
def test_people_outside_the_care_team_cannot_see_evaluations(db, client_as, role):
    _, patient, _, _ = setup_session(db)

    response = client_as(role).get(f"/api/v1/questionnaires/patients/{patient.id}/sessions")

    assert response.status_code == 403


def test_patient_is_invited_to_rate_when_reception_closes_the_session(db, client_as):
    patient_account = add_account(db, Role.PATIENT)
    patient = add_patient(db, patient_account.id)
    coach = add_account(db, Role.PROFESSIONAL)
    started = datetime.now(UTC) - timedelta(minutes=50)
    appointment = add_appointment(db, patient.id, coach.id, started, AppointmentStatus.IN_SESSION)
    appointment.arrived_at = started
    db.commit()

    client_as(Role.SECRETARY).post(
        f"/api/v1/reception/appointments/{appointment.id}/status", json={"status": "done"}
    )

    templates = db.scalars(
        select(Notification.template).where(Notification.recipient_id == patient_account.id)
    )
    assert list(templates) == [Template.SESSION_TO_RATE]
