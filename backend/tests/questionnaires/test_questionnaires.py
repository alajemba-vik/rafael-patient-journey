"""Questionnaire rules: what is due, answering once, scoring, and who sees results. Synthetic."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import AuditEvent
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import User
from app.modules.identity_access.service import Role
from app.modules.pathways.models import CarePathway, PathwayStatus
from app.modules.patients.models import Patient
from app.modules.questionnaires.models import Instrument, QuestionnaireResponse

QOL_ANSWERS = {
    "energy": 2,
    "sleep": 3,
    "mood": 2,
    "daily_activities": 3,
    "relationships": 4,
    "overall": 2,
}
SATISFACTION_ANSWERS = {"welcome": 4, "coordination": 4, "information": 3, "care": 4, "overall": 4}


def add_account(db: Session, role: Role) -> User:
    account = User(
        auth_subject=str(uuid.uuid4()),
        email=f"{uuid.uuid4().hex}@example.com",
        full_name="Alex Synthetic",
        role=role,
    )
    db.add(account)
    db.commit()
    return account


@pytest.fixture
def patient(db: Session) -> tuple[Patient, User]:
    """A patient with a login and an open pathway."""
    account = add_account(db, Role.PATIENT)
    record = Patient(
        first_name="Alex",
        last_name="Synthetic",
        birth_date=datetime(1975, 5, 5).date(),
        user_id=account.id,
    )
    db.add(record)
    db.commit()
    db.add(
        CarePathway(patient_id=record.id, coordinator_id=uuid.uuid4(), opened_at=datetime.now(UTC))
    )
    db.commit()
    return record, account


def close_pathway(db: Session, patient_id: uuid.UUID) -> None:
    pathway = db.scalar(select(CarePathway).where(CarePathway.patient_id == patient_id))
    pathway.status = PathwayStatus.CLOSED
    pathway.closed_at = datetime.now(UTC)
    db.commit()


def add_score(db: Session, patient_id: uuid.UUID, period: str, score: float) -> None:
    db.add(
        QuestionnaireResponse(
            patient_id=patient_id,
            instrument=Instrument.QUALITY_OF_LIFE,
            period=period,
            answers={},
            score=score,
            submitted_at=datetime.now(UTC),
        )
    )
    db.commit()


def audit_actions(db: Session) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


# --- what is due ----------------------------------------------------------


def test_quality_of_life_is_due_while_pathway_is_open_and_the_read_is_audited(
    db, client_as, patient
):
    _, account = patient

    body = client_as(Role.PATIENT, account.id).get("/api/v1/questionnaires/due").json()

    assert [q["instrument"] for q in body] == ["quality_of_life"]
    assert len(body[0]["questions"]) == len(QOL_ANSWERS)
    assert audit_actions(db) == ["questionnaire.due.read"]


def test_satisfaction_is_due_once_pathway_is_closed(db, client_as, patient):
    record, account = patient
    close_pathway(db, record.id)

    body = client_as(Role.PATIENT, account.id).get("/api/v1/questionnaires/due").json()

    assert [q["instrument"] for q in body] == ["satisfaction"]


def test_nothing_is_due_without_a_pathway(db, client_as):
    account = add_account(db, Role.PATIENT)
    db.add(
        Patient(
            first_name="Camille",
            last_name="Exemple",
            birth_date=datetime(1980, 1, 1).date(),
            user_id=account.id,
        )
    )
    db.commit()

    body = client_as(Role.PATIENT, account.id).get("/api/v1/questionnaires/due").json()

    assert body == []


# --- answering ------------------------------------------------------------


def test_patient_answers_and_gets_a_score_out_of_one_hundred(db, client_as, patient):
    _, account = patient
    client = client_as(Role.PATIENT, account.id)

    response = client.post(
        "/api/v1/questionnaires/quality_of_life/responses", json={"answers": QOL_ANSWERS}
    )

    assert response.status_code == 201
    assert response.json()["score"] == 66.7
    assert client.get("/api/v1/questionnaires/due").json() == []
    assert "questionnaire.quality_of_life" in audit_actions(db)


def test_same_questionnaire_cannot_be_answered_twice_in_a_month(db, client_as, patient):
    _, account = patient
    client = client_as(Role.PATIENT, account.id)
    url = "/api/v1/questionnaires/quality_of_life/responses"
    client.post(url, json={"answers": QOL_ANSWERS})

    response = client.post(url, json={"answers": QOL_ANSWERS})

    assert response.status_code == 409


def test_incomplete_or_out_of_range_answers_are_refused(db, client_as, patient):
    _, account = patient
    client = client_as(Role.PATIENT, account.id)
    url = "/api/v1/questionnaires/quality_of_life/responses"

    missing = client.post(url, json={"answers": {"energy": 2}})
    out_of_range = client.post(url, json={"answers": {**QOL_ANSWERS, "energy": 9}})

    assert missing.status_code == 400
    assert out_of_range.status_code == 400


def test_satisfaction_cannot_be_answered_before_the_end(db, client_as, patient):
    _, account = patient

    response = client_as(Role.PATIENT, account.id).post(
        "/api/v1/questionnaires/satisfaction/responses", json={"answers": SATISFACTION_ANSWERS}
    )

    assert response.status_code == 409


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.COORDINATOR, Role.SECRETARY, Role.ADMIN])
def test_only_patients_answer(db, client_as, role):
    response = client_as(role).post(
        "/api/v1/questionnaires/quality_of_life/responses", json={"answers": QOL_ANSWERS}
    )

    assert response.status_code == 403


# --- results --------------------------------------------------------------


def test_patient_sees_own_scores_with_change(db, client_as, patient):
    record, account = patient
    add_score(db, record.id, "2030-01", 50.0)
    add_score(db, record.id, "2030-02", 62.5)

    body = client_as(Role.PATIENT, account.id).get("/api/v1/questionnaires/scores/mine").json()

    assert [(s["period"], s["score"], s["change"]) for s in body] == [
        ("2030-01", 50.0, None),
        ("2030-02", 62.5, 12.5),
    ]


def test_care_team_sees_patient_scores_and_it_is_audited(db, client_as, patient):
    record, _ = patient
    professional = add_account(db, Role.PROFESSIONAL)
    db.add(CareAssignment(professional_id=professional.id, patient_id=record.id))
    db.commit()
    add_score(db, record.id, "2030-01", 50.0)

    response = client_as(Role.PROFESSIONAL, professional.id).get(
        f"/api/v1/questionnaires/patients/{record.id}/scores"
    )

    assert response.json()[0]["score"] == 50.0
    assert audit_actions(db) == ["questionnaire.read"]


@pytest.mark.parametrize(
    "role", [Role.PROFESSIONAL, Role.COORDINATOR, Role.SECRETARY, Role.PATIENT, Role.ADMIN]
)
def test_outsiders_cannot_see_scores_and_it_is_audited(db, client_as, patient, role):
    record, _ = patient

    response = client_as(role).get(f"/api/v1/questionnaires/patients/{record.id}/scores")

    assert response.status_code == 403
    assert audit_actions(db) == ["questionnaire.read.denied"]
