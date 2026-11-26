"""Messages between a patient and their care team: who reads, who writes, who is told.

All data is synthetic.
"""

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.notifications.models import Notification, Template
from tests.pathways.test_pathways import add_account, add_patient, assign


def audit_actions(db) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


def notified(db, user_id) -> list[Template]:
    return list(
        db.scalars(select(Notification.template).where(Notification.recipient_id == user_id))
    )


def test_patient_writes_to_their_care_team_and_every_member_is_told(db, client_as):
    patient_account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, patient_account.id)
    coordinator = add_account(db, Role.COORDINATOR)
    practitioner = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    assign(db, coordinator.id, patient.id)
    assign(db, practitioner.id, patient.id)

    response = client_as(Role.PATIENT, patient_account.id).post(
        "/api/v1/pathways/messages/mine", json={"body": "  Puis-je décaler ma séance ?  "}
    )

    assert response.status_code == 201
    assert response.json()["body"] == "Puis-je décaler ma séance ?"
    assert response.json()["from_patient"] is True
    assert notified(db, coordinator.id) == [Template.MESSAGE_RECEIVED]
    assert notified(db, practitioner.id) == [Template.MESSAGE_RECEIVED]
    assert "message.send" in audit_actions(db)


def test_care_team_member_answers_and_the_patient_is_told(db, client_as):
    patient_account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, patient_account.id)
    practitioner = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    assign(db, practitioner.id, patient.id)
    client = client_as(Role.PROFESSIONAL, practitioner.id)

    client.post(f"/api/v1/pathways/patients/{patient.id}/messages", json={"body": "Oui, bien sûr."})
    thread = client.get(f"/api/v1/pathways/patients/{patient.id}/messages").json()

    assert [(m["sender_name"], m["from_patient"]) for m in thread] == [("Jordan Praticien", False)]
    assert notified(db, patient_account.id) == [Template.MESSAGE_RECEIVED]
    assert "message.read" in audit_actions(db)


def test_patient_reads_their_conversation_in_order(db, client_as):
    patient_account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, patient_account.id)
    practitioner = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    assign(db, practitioner.id, patient.id)
    client_as(Role.PATIENT, patient_account.id).post(
        "/api/v1/pathways/messages/mine", json={"body": "Bonjour"}
    )
    client_as(Role.PROFESSIONAL, practitioner.id).post(
        f"/api/v1/pathways/patients/{patient.id}/messages", json={"body": "Bonjour Alex"}
    )

    thread = client_as(Role.PATIENT, patient_account.id).get("/api/v1/pathways/messages/mine")

    assert [m["body"] for m in thread.json()] == ["Bonjour", "Bonjour Alex"]
    assert thread.json()[0]["sender_name"] == "Alex Synthetic"


def test_professional_outside_care_team_is_denied_and_it_is_audited(db, client_as):
    patient = add_patient(db)
    outsider = add_account(db, Role.PROFESSIONAL)
    client = client_as(Role.PROFESSIONAL, outsider.id)

    read = client.get(f"/api/v1/pathways/patients/{patient.id}/messages")
    write = client.post(f"/api/v1/pathways/patients/{patient.id}/messages", json={"body": "Hi"})

    assert (read.status_code, write.status_code) == (403, 403)
    assert {"message.read.denied", "message.send.denied"} <= set(audit_actions(db))


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.ADMIN])
def test_office_roles_cannot_read_or_write_messages(db, client_as, role):
    patient = add_patient(db)

    response = client_as(role).get(f"/api/v1/pathways/patients/{patient.id}/messages")

    assert response.status_code == 403


def test_patient_cannot_read_another_patients_conversation(db, client_as):
    me = add_account(db, Role.PATIENT)
    add_patient(db, me.id)
    someone_else = add_patient(db)

    response = client_as(Role.PATIENT, me.id).get(
        f"/api/v1/pathways/patients/{someone_else.id}/messages"
    )

    assert response.status_code == 403


def test_empty_message_is_refused(db, client_as):
    me = add_account(db, Role.PATIENT)
    add_patient(db, me.id)

    response = client_as(Role.PATIENT, me.id).post(
        "/api/v1/pathways/messages/mine", json={"body": "   "}
    )

    assert response.status_code == 422
