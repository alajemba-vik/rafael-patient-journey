"""Dashboard rules: care staff and admins see de-identified totals; small groups stay hidden."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.modules.identity_access.service import Role
from app.modules.pathways.models import CarePathway, MilestoneKind, PathwayMilestone, PathwayStatus
from app.modules.questionnaires.models import Instrument, QuestionnaireResponse
from app.modules.scheduling.models import Appointment, AppointmentStatus

THIS_MONTH = datetime.now(UTC).strftime("%Y-%m")
LOW = dict.fromkeys(["physical", "psychological", "emotional", "sexual", "socio_professional"], 1)
HIGH = {**LOW, "physical": 3, "emotional": 2}
SATISFIED = {"welcome": 4, "coordination": 4, "information": 3, "care": 4, "overall": 4}


def add_quality_of_life(db: Session, count: int, score: float) -> None:
    for _ in range(count):
        db.add(
            QuestionnaireResponse(
                patient_id=uuid.uuid4(),
                instrument=Instrument.QUALITY_OF_LIFE,
                period=THIS_MONTH,
                answers={},
                score=score,
                submitted_at=datetime.now(UTC),
            )
        )
    db.commit()


def add_satisfaction(db: Session, count: int) -> None:
    for _ in range(count):
        db.add(
            QuestionnaireResponse(
                patient_id=uuid.uuid4(),
                instrument=Instrument.SATISFACTION,
                period=str(uuid.uuid4()),
                answers=SATISFIED,
                score=95.0,
                submitted_at=datetime.now(UTC),
            )
        )
    db.commit()


def add_finished_pathways(db: Session, count: int) -> None:
    for _ in range(count):
        pathway = CarePathway(
            patient_id=uuid.uuid4(),
            coordinator_id=uuid.uuid4(),
            opened_at=datetime.now(UTC),
            status=PathwayStatus.CLOSED,
        )
        db.add(pathway)
        db.flush()
        for kind, scores in ((MilestoneKind.INTAKE, LOW), (MilestoneKind.FINAL, HIGH)):
            db.add(
                PathwayMilestone(
                    pathway_id=pathway.id,
                    kind=kind,
                    recorded_at=datetime.now(UTC),
                    recorded_by=pathway.coordinator_id,
                    **scores,
                )
            )
    db.commit()


def add_appointments(db: Session, status: AppointmentStatus, count: int) -> None:
    for i in range(count):
        starts_at = datetime.now(UTC) - timedelta(days=1, hours=i)
        db.add(
            Appointment(
                patient_id=uuid.uuid4(),
                professional_id=uuid.uuid4(),
                starts_at=starts_at,
                ends_at=starts_at + timedelta(minutes=45),
                status=status,
                created_by=uuid.uuid4(),
            )
        )
    db.commit()


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.COORDINATOR, Role.ADMIN])
def test_care_staff_and_admins_see_the_dashboard(db, client_as, role):
    response = client_as(role).get("/api/v1/analytics/dashboard")

    assert response.status_code == 200
    assert response.json()["min_group_size"] == 5


@pytest.mark.parametrize("role", [Role.PATIENT, Role.SECRETARY])
def test_patients_and_reception_do_not(db, client_as, role):
    response = client_as(role).get("/api/v1/analytics/dashboard")

    assert response.status_code == 403


def test_small_groups_are_counted_but_their_averages_hidden(db, client_as):
    add_quality_of_life(db, 4, 80.0)
    add_satisfaction(db, 4)
    add_finished_pathways(db, 4)
    add_appointments(db, AppointmentStatus.NO_SHOW, 1)

    body = client_as(Role.ADMIN).get("/api/v1/analytics/dashboard").json()

    assert body["quality_of_life"] == [{"period": THIS_MONTH, "respondents": 4, "average": None}]
    assert body["satisfaction"]["average"] is None
    assert {d["average_change"] for d in body["self_assessment"]["by_dimension"]} == {None}
    assert body["attendance"]["no_show_rate"] is None


def test_large_enough_groups_show_their_averages(db, client_as):
    add_quality_of_life(db, 5, 80.0)
    add_satisfaction(db, 5)
    add_finished_pathways(db, 5)

    body = client_as(Role.COORDINATOR).get("/api/v1/analytics/dashboard").json()

    assert body["quality_of_life"][0]["average"] == 80.0
    assert body["satisfaction"]["average"] == 95.0
    assert body["satisfaction"]["by_question"][2] == {
        "question": "Les informations reçues sur votre parcours",
        "average": 75.0,
    }
    changes = {d["dimension"]: d["average_change"] for d in body["self_assessment"]["by_dimension"]}
    assert changes["physical"] == 2.0
    assert changes["emotional"] == 1.0
    assert changes["sexual"] == 0.0


def test_attendance_counts_done_and_no_shows(db, client_as):
    add_appointments(db, AppointmentStatus.DONE, 4)
    add_appointments(db, AppointmentStatus.NO_SHOW, 1)
    add_appointments(db, AppointmentStatus.CANCELLED, 3)

    body = client_as(Role.ADMIN).get("/api/v1/analytics/dashboard").json()

    assert body["attendance"]["done"] == 4
    assert body["attendance"]["no_show"] == 1
    assert body["attendance"]["no_show_rate"] == 20.0


def test_active_pathways_are_counted(db, client_as):
    db.add(
        CarePathway(
            patient_id=uuid.uuid4(), coordinator_id=uuid.uuid4(), opened_at=datetime.now(UTC)
        )
    )
    db.commit()
    add_finished_pathways(db, 2)

    body = client_as(Role.ADMIN).get("/api/v1/analytics/dashboard").json()

    assert body["active_pathways"] == 1
