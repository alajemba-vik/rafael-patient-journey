"""Flagged needs: practitioners tell the referent coordinator, who resolves them. Synthetic data."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.pathways.models import CarePathway, PathwayNeed, PathwayStatus
from app.modules.patients.models import Patient


def add_account(db: Session, role: Role, full_name: str) -> User:
    account = User(
        auth_subject=str(uuid.uuid4()),
        email=f"{uuid.uuid4().hex}@example.com",
        full_name=full_name,
        role=role,
    )
    db.add(account)
    db.commit()
    return account


@pytest.fixture
def pathway(db: Session) -> tuple[CarePathway, User, User]:
    """An open pathway led by a coordinator, with a practitioner in the care team."""
    patient = Patient(
        first_name="Alex", last_name="Synthetic", birth_date=datetime(1975, 5, 5).date()
    )
    db.add(patient)
    db.commit()
    coordinator = add_account(db, Role.COORDINATOR, "Claire Coordination")
    professional = add_account(db, Role.PROFESSIONAL, "Jordan Praticien")
    for member in (coordinator, professional):
        db.add(CareAssignment(professional_id=member.id, patient_id=patient.id))
    pathway = CarePathway(
        patient_id=patient.id, coordinator_id=coordinator.id, opened_at=datetime.now(UTC)
    )
    db.add(pathway)
    db.commit()
    return pathway, coordinator, professional


def add_need(db: Session, pathway: CarePathway, raised_by: uuid.UUID) -> PathwayNeed:
    need = PathwayNeed(
        pathway_id=pathway.id, raised_by=raised_by, raised_at=datetime.now(UTC), note="Douleurs"
    )
    db.add(need)
    db.commit()
    return need


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


def test_practitioner_flags_a_need_and_it_is_audited(db, client_as, pathway):
    path, _, professional = pathway

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/pathways/{path.id}/needs", json={"note": "Troubles du sommeil à évoquer"}
    )

    assert response.status_code == 201
    assert response.json()["raised_by_name"] == "Jordan Praticien"
    assert audit_actions(db) == ["pathway.need"]


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT, Role.ADMIN])
def test_outsiders_cannot_flag_needs_and_it_is_audited(db, client_as, pathway, role):
    path, _, _ = pathway

    response = client_as(role).post(f"/api/v1/pathways/{path.id}/needs", json={"note": "Note"})

    assert response.status_code == 403
    assert audit_actions(db) == ["pathway.need.denied"]


def test_closed_pathway_takes_no_needs(db, client_as, pathway):
    path, _, professional = pathway
    path.status = PathwayStatus.CLOSED
    db.commit()

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/pathways/{path.id}/needs", json={"note": "Note"}
    )

    assert response.status_code == 409


def test_referent_coordinator_sees_open_needs_with_names(db, client_as, pathway):
    path, coordinator, professional = pathway
    add_need(db, path, professional.id)
    resolved = add_need(db, path, professional.id)
    resolved.resolved_at = datetime.now(UTC)
    db.commit()

    body = client_as(Role.COORDINATOR, coordinator.id).get("/api/v1/pathways/needs").json()

    assert len(body) == 1
    assert body[0]["patient_name"] == "Alex Synthetic"
    assert body[0]["raised_by_name"] == "Jordan Praticien"


def test_other_coordinators_do_not_get_the_need(db, client_as, pathway):
    path, _, professional = pathway
    add_need(db, path, professional.id)

    body = client_as(Role.COORDINATOR).get("/api/v1/pathways/needs").json()

    assert body == []


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.PATIENT, Role.ADMIN])
def test_only_coordinators_have_a_needs_inbox(db, client_as, role):
    response = client_as(role).get("/api/v1/pathways/needs")

    assert response.status_code == 403


def test_coordinator_resolves_a_need_and_it_is_audited(db, client_as, pathway):
    path, coordinator, professional = pathway
    need = add_need(db, path, professional.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/needs/{need.id}/resolve"
    )

    assert response.json()["resolved_at"] is not None
    assert audit_actions(db) == ["pathway.need.resolve"]


def test_practitioner_cannot_resolve_a_need(db, client_as, pathway):
    path, _, professional = pathway
    need = add_need(db, path, professional.id)

    response = client_as(Role.PROFESSIONAL, professional.id).post(
        f"/api/v1/pathways/needs/{need.id}/resolve"
    )

    assert response.status_code == 403
    assert db.get(PathwayNeed, need.id).resolved_at is None
