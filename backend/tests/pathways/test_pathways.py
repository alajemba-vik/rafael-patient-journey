"""Pathway rules: the team coordinator leads, the team reads, the patient sees their own.

All data is synthetic.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.pathways.models import (
    CarePathway,
    MilestoneKind,
    PathwayMilestone,
    PathwayStatus,
)
from app.modules.patients.models import Patient

SCORES = {"physical": 2, "psychological": 1, "emotional": 3, "sexual": 2, "socio_professional": 1}


def add_account(db: Session, role: Role, full_name: str = "Claire Coordination") -> User:
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
        first_name="Alex",
        last_name="Synthetic",
        birth_date=datetime(1975, 5, 5).date(),
        user_id=user_id,
    )
    db.add(patient)
    db.commit()
    return patient


def assign(db: Session, professional_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    db.add(CareAssignment(professional_id=professional_id, patient_id=patient_id))
    db.commit()


def add_pathway(
    db: Session, patient_id: uuid.UUID, coordinator_id: uuid.UUID, opened_at: datetime | None = None
) -> CarePathway:
    pathway = CarePathway(
        patient_id=patient_id,
        coordinator_id=coordinator_id,
        opened_at=opened_at or datetime.now(UTC),
    )
    db.add(pathway)
    db.commit()
    return pathway


def add_milestone(db: Session, pathway: CarePathway, kind: MilestoneKind) -> None:
    db.add(
        PathwayMilestone(
            pathway_id=pathway.id,
            kind=kind,
            recorded_at=datetime.now(UTC),
            recorded_by=pathway.coordinator_id,
            note="Note de coordination",
            **SCORES,
        )
    )
    db.commit()


def milestone(kind: str = "intake") -> dict:
    return {
        "kind": kind,
        **SCORES,
        "symptoms": [{"name": "Fatigue", "intensity": 7}],
        "goals": "Reprendre la marche",
        "plan": "Activité physique adaptée, sophrologie",
        "note": "Note de coordination",
    }


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


@pytest.fixture
def team(db: Session) -> tuple[Patient, User, User]:
    """A patient whose care team has a coordinator and a practitioner."""
    patient = add_patient(db)
    coordinator = add_account(db, Role.COORDINATOR)
    professional = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    assign(db, coordinator.id, patient.id)
    assign(db, professional.id, patient.id)
    return patient, coordinator, professional


# --- open and close -------------------------------------------------------


def test_team_coordinator_opens_pathway_and_becomes_referent(db, client_as, team):
    patient, coordinator, _ = team

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        "/api/v1/pathways", json={"patient_id": str(patient.id)}
    )

    assert response.status_code == 201
    assert response.json()["coordinator_name"] == "Claire Coordination"
    assert response.json()["status"] == "open"
    assert audit_actions(db) == ["pathway.open"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT, Role.ADMIN])
def test_other_roles_cannot_open_and_it_is_audited(db, client_as, team, role):
    patient, _, professional = team
    user_id = professional.id if role == Role.PROFESSIONAL else None

    response = client_as(role, user_id).post(
        "/api/v1/pathways", json={"patient_id": str(patient.id)}
    )

    assert response.status_code == 403
    assert audit_actions(db) == ["pathway.open.denied"]


def test_coordinator_outside_care_team_cannot_open(db, client_as, team):
    patient, _, _ = team

    response = client_as(Role.COORDINATOR).post(
        "/api/v1/pathways", json={"patient_id": str(patient.id)}
    )

    assert response.status_code == 403


def test_second_open_pathway_is_refused(db, client_as, team):
    patient, coordinator, _ = team
    add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        "/api/v1/pathways", json={"patient_id": str(patient.id)}
    )

    assert response.status_code == 409


def test_database_refuses_a_second_open_pathway_even_without_the_service(db, team):
    patient, coordinator, _ = team
    add_pathway(db, patient.id, coordinator.id)

    with pytest.raises(IntegrityError):
        add_pathway(db, patient.id, coordinator.id)


def test_coordinator_closes_pathway(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/close"
    )

    assert response.json()["status"] == "closed"
    assert response.json()["closed_at"] is not None


def test_practitioner_cannot_close_pathway(db, client_as, team):
    patient, coordinator, professional = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/pathways/{pathway.id}/close"
    )

    assert response.status_code == 403
    assert db.get(CarePathway, pathway.id).status == PathwayStatus.OPEN


# --- milestones -----------------------------------------------------------


def test_coordinator_records_intake_with_symptoms_goals_and_plan(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json=milestone("intake")
    )

    recorded = response.json()["milestones"][0]
    assert response.status_code == 201
    assert recorded["emotional"] == 3
    assert recorded["symptoms"] == [{"name": "Fatigue", "intensity": 7}]
    assert recorded["plan"] == "Activité physique adaptée, sophrologie"
    assert audit_actions(db) == ["pathway.intake"]


def test_review_needs_an_intake_first(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json=milestone("review")
    )

    assert response.status_code == 409


def test_same_milestone_cannot_be_recorded_twice(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)
    add_milestone(db, pathway, MilestoneKind.INTAKE)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json=milestone("intake")
    )

    assert response.status_code == 409


def test_scores_stay_between_zero_and_four(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json={**milestone(), "physical": 5}
    )

    assert response.status_code == 422


def test_closed_pathway_takes_no_more_milestones(db, client_as, team):
    patient, coordinator, _ = team
    pathway = add_pathway(db, patient.id, coordinator.id)
    pathway.status = PathwayStatus.CLOSED
    db.commit()

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json=milestone()
    )

    assert response.status_code == 409


def test_practitioner_cannot_record_milestones(db, client_as, team):
    patient, coordinator, professional = team
    pathway = add_pathway(db, patient.id, coordinator.id)

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json=milestone()
    )

    assert response.status_code == 403
    assert audit_actions(db) == ["pathway.milestone.denied"]


# --- reading --------------------------------------------------------------


def test_care_team_reads_pathway_with_notes(db, client_as, team):
    patient, coordinator, professional = team
    add_milestone(db, add_pathway(db, patient.id, coordinator.id), MilestoneKind.INTAKE)

    body = (
        client_as(Role.PROFESSIONAL, professional.id)
        .get(f"/api/v1/pathways/patients/{patient.id}")
        .json()
    )

    assert body[0]["milestones"][0]["note"] == "Note de coordination"
    assert audit_actions(db) == ["pathway.read"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT, Role.ADMIN])
def test_outsiders_cannot_read_pathways_and_it_is_audited(db, client_as, team, role):
    patient, coordinator, _ = team
    add_pathway(db, patient.id, coordinator.id)

    response = client_as(role).get(f"/api/v1/pathways/patients/{patient.id}")

    assert response.status_code == 403
    assert audit_actions(db) == ["pathway.read.denied"]


def test_patient_sees_own_pathway_and_coordinator_but_not_notes(db, client_as, team):
    _, coordinator, _ = team
    account = add_account(db, Role.PATIENT, "Alex Synthetic")
    patient = add_patient(db, user_id=account.id)
    add_milestone(db, add_pathway(db, patient.id, coordinator.id), MilestoneKind.INTAKE)

    body = client_as(Role.PATIENT, account.id).get("/api/v1/pathways/mine").json()

    assert body[0]["coordinator_name"] == "Claire Coordination"
    assert body[0]["milestones"][0]["physical"] == 2
    assert "note" not in body[0]["milestones"][0]


def test_coordinator_sees_led_pathways_with_next_milestone_due(db, client_as, team):
    patient, coordinator, _ = team
    opened = datetime(2030, 1, 1, tzinfo=UTC)
    add_milestone(db, add_pathway(db, patient.id, coordinator.id, opened), MilestoneKind.INTAKE)

    body = client_as(Role.COORDINATOR, coordinator.id).get("/api/v1/pathways/led").json()

    assert body[0]["patient_name"] == "Alex Synthetic"
    assert body[0]["next_milestone"] == "review"
    assert body[0]["next_due_on"] == str((opened + timedelta(days=91)).date())


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT, Role.ADMIN])
def test_only_coordinators_have_led_pathways(db, client_as, role):
    response = client_as(role).get("/api/v1/pathways/led")

    assert response.status_code == 403
