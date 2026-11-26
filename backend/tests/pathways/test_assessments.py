"""Assessment day (HDJ) tests and the structured care plan. All data is synthetic."""

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.pathways.models import AssessmentTest, PathwayStatus
from app.modules.pathways.service import band_of
from tests.pathways.test_pathways import SCORES, add_account, add_pathway, add_patient, assign


def audit_actions(db) -> list[str]:
    return list(db.scalars(select(AuditEvent.action)))


def setup(db):
    patient = add_patient(db)
    coordinator = add_account(db, Role.COORDINATOR)
    coach = add_account(db, Role.PROFESSIONAL, "Jordan Coach")
    assign(db, coordinator.id, patient.id)
    assign(db, coach.id, patient.id)
    pathway = add_pathway(db, patient.id, coordinator.id)
    return patient, coordinator, coach, pathway


@pytest.mark.parametrize(
    ("test", "value", "band"),
    [
        (AssessmentTest.K10, 19, "well"),
        (AssessmentTest.K10, 23, "mild"),
        (AssessmentTest.K10, 27, "moderate"),
        (AssessmentTest.K10, 30, "severe"),
        (AssessmentTest.MNA_SCREENING, 7, "malnourished"),
        (AssessmentTest.MNA_SCREENING, 11, "at_risk"),
        (AssessmentTest.MNA_SCREENING, 13, "normal"),
        (AssessmentTest.MARSHALL, 3, "insufficiently_active"),
        (AssessmentTest.MARSHALL, 6, "sufficiently_active"),
        (AssessmentTest.SITTING_HOURS, 2, "low"),
        (AssessmentTest.SITTING_HOURS, 7, "moderate"),
        (AssessmentTest.SITTING_HOURS, 9, "high"),
        (AssessmentTest.HANDGRIP, 25, None),
    ],
)
def test_each_score_reads_as_the_institutes_report_reads_it(test, value, band):
    assert band_of(test, value) == band


def test_a_team_member_records_a_test_and_the_team_reads_it_with_its_band(db, client_as):
    patient, coordinator, coach, pathway = setup(db)

    recorded = client_as(Role.PROFESSIONAL, coach.id).post(
        f"/api/v1/pathways/{pathway.id}/assessments",
        json={"kind": "intake", "test": "marshall", "value": 6},
    )
    listed = client_as(Role.COORDINATOR, coordinator.id).get(
        f"/api/v1/pathways/patients/{patient.id}/assessments"
    )

    assert recorded.status_code == 200
    assert listed.json() == [
        {
            **recorded.json(),
            "band": "sufficiently_active",
            "recorded_by_name": "Jordan Coach",
        }
    ]
    assert {"assessment.record", "assessment.read"} <= set(audit_actions(db))


def test_recording_a_test_again_replaces_it(db, client_as):
    _, _, coach, pathway = setup(db)
    client = client_as(Role.PROFESSIONAL, coach.id)
    url = f"/api/v1/pathways/{pathway.id}/assessments"

    client.post(url, json={"kind": "intake", "test": "k10", "value": 31})
    client.post(url, json={"kind": "intake", "test": "k10", "value": 24})
    client.post(url, json={"kind": "review", "test": "k10", "value": 18})

    scores = client.get(f"/api/v1/pathways/patients/{pathway.patient_id}/assessments").json()
    assert [(s["kind"], s["value"], s["band"]) for s in scores] == [
        ("intake", 24, "mild"),
        ("review", 18, "well"),
    ]


def test_a_score_outside_the_tests_range_is_refused(db, client_as):
    _, _, coach, pathway = setup(db)

    response = client_as(Role.PROFESSIONAL, coach.id).post(
        f"/api/v1/pathways/{pathway.id}/assessments",
        json={"kind": "intake", "test": "k10", "value": 5},
    )

    assert response.status_code == 400


def test_a_closed_pathway_takes_no_more_scores(db, client_as):
    _, _, coach, pathway = setup(db)
    pathway.status = PathwayStatus.CLOSED
    db.commit()

    response = client_as(Role.PROFESSIONAL, coach.id).post(
        f"/api/v1/pathways/{pathway.id}/assessments",
        json={"kind": "intake", "test": "k10", "value": 20},
    )

    assert response.status_code == 409


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.SECRETARY, Role.ADMIN, Role.PATIENT])
def test_people_outside_the_care_team_can_neither_record_nor_read(db, client_as, role):
    patient, _, _, pathway = setup(db)
    client = client_as(role)

    write = client.post(
        f"/api/v1/pathways/{pathway.id}/assessments",
        json={"kind": "intake", "test": "k10", "value": 20},
    )
    read = client.get(f"/api/v1/pathways/patients/{patient.id}/assessments")

    assert (write.status_code, read.status_code) == (403, 403)
    assert "assessment.record.denied" in audit_actions(db)


def test_the_intake_carries_the_care_plan_goals_and_disciplines(db, client_as):
    patient, coordinator, _, pathway = setup(db)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones",
        json={
            "kind": "intake",
            **SCORES,
            "goal_codes": ["sleep", "muscle_strength"],
            "discipline_codes": ["adapted_physical_activity", "sophrology"],
        },
    )

    [intake] = response.json()["milestones"]
    assert intake["goal_codes"] == ["sleep", "muscle_strength"]
    assert intake["discipline_codes"] == ["adapted_physical_activity", "sophrology"]


@pytest.mark.parametrize(
    "plan",
    [
        {"goal_codes": ["sleep", "pain", "wellbeing", "self_esteem"]},
        {"goal_codes": ["sleep", "sleep"]},
        {"discipline_codes": ["yoga", "pilates", "reiki", "massage", "tuina", "hypnosis"]},
        {"discipline_codes": ["underwater_basket_weaving"]},
    ],
)
def test_a_care_plan_beyond_the_institutes_limits_is_refused(db, client_as, plan):
    _, coordinator, _, pathway = setup(db)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        f"/api/v1/pathways/{pathway.id}/milestones", json={"kind": "intake", **SCORES, **plan}
    )

    assert response.status_code == 422
