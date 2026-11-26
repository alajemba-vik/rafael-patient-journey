"""Care-team rules: who may add, remove and see a patient's care team. All data is synthetic."""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.notifications.models import Notification, Template

PATIENT_ID = uuid.uuid4()


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


def assign(db: Session, professional_id: uuid.UUID) -> CareAssignment:
    assignment = CareAssignment(patient_id=PATIENT_ID, professional_id=professional_id)
    db.add(assignment)
    db.commit()
    return assignment


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


# --- assign ---------------------------------------------------------------


@pytest.mark.parametrize("role", [Role.COORDINATOR, Role.ADMIN])
def test_coordinator_or_admin_adds_professional_and_it_is_audited(db, client_as, role):
    professional = add_account(db, Role.PROFESSIONAL)

    response = client_as(role).post(
        "/api/v1/care-team/assignments",
        json={"patient_id": str(PATIENT_ID), "professional_id": str(professional.id)},
    )

    assert response.status_code == 201
    assert response.json()["professional_id"] == str(professional.id)
    assert audit_actions(db) == ["care_team.assign"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT])
def test_roles_outside_the_team_cannot_add_and_it_is_audited(db, client_as, role):
    professional = add_account(db, Role.PROFESSIONAL)

    response = client_as(role).post(
        "/api/v1/care-team/assignments",
        json={"patient_id": str(PATIENT_ID), "professional_id": str(professional.id)},
    )

    assert response.status_code == 403
    assert db.scalar(select(CareAssignment)) is None
    assert audit_actions(db) == ["care_team.assign.denied"]


def test_only_professionals_and_coordinators_can_join_a_team(db, client_as):
    account = add_account(db, Role.SECRETARY)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/care-team/assignments",
        json={"patient_id": str(PATIENT_ID), "professional_id": str(account.id)},
    )

    assert response.status_code == 404


def test_same_professional_cannot_be_added_twice(db, client_as):
    professional = add_account(db, Role.PROFESSIONAL)
    assign(db, professional.id)

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/care-team/assignments",
        json={"patient_id": str(PATIENT_ID), "professional_id": str(professional.id)},
    )

    assert response.status_code == 409


# --- remove ---------------------------------------------------------------


def test_coordinator_removes_assignment_and_it_is_audited(db, client_as):
    assignment = assign(db, add_account(db, Role.PROFESSIONAL).id)

    response = client_as(Role.COORDINATOR).delete(f"/api/v1/care-team/assignments/{assignment.id}")

    assert response.status_code == 204
    assert db.scalar(select(CareAssignment)) is None
    assert audit_actions(db) == ["care_team.remove"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT])
def test_other_roles_cannot_remove(db, client_as, role):
    assignment = assign(db, add_account(db, Role.PROFESSIONAL).id)

    response = client_as(role).delete(f"/api/v1/care-team/assignments/{assignment.id}")

    assert response.status_code == 403
    assert db.scalar(select(CareAssignment)) is not None
    assert audit_actions(db) == ["care_team.remove.denied"]


# --- list -----------------------------------------------------------------


def test_coordinator_sees_team_with_names_and_roles(db, client_as):
    professional = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    coordinator = add_account(db, Role.COORDINATOR, "Claire Coordination")
    assign(db, professional.id)
    assign(db, coordinator.id)

    response = client_as(Role.COORDINATOR).get(f"/api/v1/care-team/patients/{PATIENT_ID}/members")

    assert response.status_code == 200
    assert [(m["full_name"], m["role"]) for m in response.json()] == [
        ("Claire Coordination", "coordinator"),
        ("Jordan Praticien", "professional"),
    ]
    assert audit_actions(db) == ["care_team.read"]


def test_professional_in_team_sees_team(db, client_as):
    professional = add_account(db, Role.PROFESSIONAL)
    assign(db, professional.id)

    response = client_as(Role.PROFESSIONAL, professional.id).get(
        f"/api/v1/care-team/patients/{PATIENT_ID}/members"
    )

    assert response.status_code == 200


def test_secretary_sees_team_to_book_with_its_members(db, client_as):
    assign(db, add_account(db, Role.PROFESSIONAL).id)

    response = client_as(Role.SECRETARY).get(f"/api/v1/care-team/patients/{PATIENT_ID}/members")

    assert response.status_code == 200


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.PATIENT])
def test_outsiders_cannot_see_team_and_it_is_audited(db, client_as, role):
    assign(db, add_account(db, Role.PROFESSIONAL).id)

    response = client_as(role).get(f"/api/v1/care-team/patients/{PATIENT_ID}/members")

    assert response.status_code == 403
    assert audit_actions(db) == ["care_team.read.denied"]


# --- sharing with a reason ------------------------------------------------


def test_sharing_records_reason_note_and_who_and_tells_the_new_member(db, client_as):

    coordinator = add_account(db, Role.COORDINATOR, "Claire Coordination")
    dietitian = add_account(db, Role.PROFESSIONAL, "Nadia Diététique")

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        "/api/v1/care-team/assignments",
        json={
            "patient_id": str(PATIENT_ID),
            "professional_id": str(dietitian.id),
            "reason": "convocation",
            "note": "Bilan nutrition en janvier",
        },
    )
    assert response.status_code == 201

    sent = list(db.scalars(select(Notification).where(Notification.recipient_id == dietitian.id)))
    assert [(n.template, n.subject_id, n.params) for n in sent] == [
        (Template.FILE_SHARED, PATIENT_ID, {"reason": "convocation"})
    ]
    member = (
        client_as(Role.COORDINATOR, coordinator.id)
        .get(f"/api/v1/care-team/patients/{PATIENT_ID}/members")
        .json()[0]
    )
    assert member["reason"] == "convocation"
    assert member["note"] == "Bilan nutrition en janvier"
    assert member["added_by_name"] == "Claire Coordination"
    assert member["added_at"] is not None


def test_a_coordinator_taking_a_patient_on_is_not_notified_and_defaults_to_care_team(db, client_as):

    coordinator = add_account(db, Role.COORDINATOR)

    client_as(Role.COORDINATOR, coordinator.id).post(
        "/api/v1/care-team/assignments",
        json={"patient_id": str(PATIENT_ID), "professional_id": str(coordinator.id)},
    )

    assert db.scalars(select(Notification)).all() == []
    assert db.scalar(select(CareAssignment.reason)) == "care_team"


def test_older_assignments_without_a_reason_still_list(db, client_as):
    professional = add_account(db, Role.PROFESSIONAL)
    assign(db, professional.id)

    member = (
        client_as(Role.COORDINATOR)
        .get(f"/api/v1/care-team/patients/{PATIENT_ID}/members")
        .json()[0]
    )

    assert member["reason"] is None and member["added_by_name"] is None


def test_a_practitioner_in_the_team_shares_the_file_with_a_colleague(db, client_as):
    practitioner = add_account(db, Role.PROFESSIONAL, "Nadia Diététique")
    colleague = add_account(db, Role.PROFESSIONAL, "Sam Sophrologie")
    assign(db, practitioner.id)

    response = client_as(Role.PROFESSIONAL, practitioner.id).post(
        "/api/v1/care-team/assignments",
        json={
            "patient_id": str(PATIENT_ID),
            "professional_id": str(colleague.id),
            "reason": "medical_opinion",
        },
    )

    assert response.status_code == 201
    assert "care_team.assign" in audit_actions(db)
    sent = db.scalars(select(Notification).where(Notification.recipient_id == colleague.id))
    assert [n.template for n in sent] == [Template.FILE_SHARED]


def test_a_practitioner_in_the_team_still_cannot_remove_anyone(db, client_as):
    practitioner = add_account(db, Role.PROFESSIONAL)
    colleague = add_account(db, Role.PROFESSIONAL)
    assign(db, practitioner.id)
    assignment = assign(db, colleague.id)

    response = client_as(Role.PROFESSIONAL, practitioner.id).delete(
        f"/api/v1/care-team/assignments/{assignment.id}"
    )

    assert response.status_code == 403
    assert "care_team.remove.denied" in audit_actions(db)
