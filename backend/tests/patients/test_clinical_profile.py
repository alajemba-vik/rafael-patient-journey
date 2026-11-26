"""Clinical profile: who may read and update it, and what is kept. Synthetic data only."""

import uuid

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.patients.models import Treatment
from tests.patients.test_patients import add_patient, assign

PROFILE = {
    "cancer_site": "breast",
    "diagnosed_on": "2025-03-01",
    "metastatic": False,
    "height_cm": 168,
    "weight_kg": 64,
    "occupation": "  Teacher  ",
    "work_situation": "sick_leave",
    "lives_alone": True,
    "has_caregivers": True,
    "caregivers": "A sister",
    "smoker": False,
    "drinks_alcohol": True,
    "drinks_per_week": 3,
    "notes": "",
    "treatments": [
        {
            "kind": "chemotherapy",
            "status": "finished",
            "started_on": "2025-04-01",
            "ended_on": "2025-08-01",
            "details": "Synthetic protocol",
        },
        {"kind": "hormone_therapy", "status": "ongoing", "started_on": "2025-10-01"},
    ],
}


def url(patient_id: uuid.UUID) -> str:
    return f"/api/v1/patients/{patient_id}/clinical-profile"


def actions(db, patient_id: uuid.UUID) -> list[str]:
    return list(db.scalars(select(AuditEvent.action).where(AuditEvent.patient_id == patient_id)))


@pytest.mark.parametrize("role", [Role.PROFESSIONAL, Role.COORDINATOR])
def test_care_team_records_then_reads_the_profile(db, client_as, role):
    patient = add_patient(db)
    member = uuid.uuid4()
    assign(db, member, patient.id)
    client = client_as(role, member)

    saved = client.put(url(patient.id), json=PROFILE)
    assert saved.status_code == 200
    body = saved.json()
    assert body["occupation"] == "Teacher"
    assert body["notes"] is None
    assert body["updated_by"] == str(member)
    assert [t["kind"] for t in body["treatments"]] == ["hormone_therapy", "chemotherapy"]

    read = client.get(url(patient.id)).json()
    # SQLite drops the time zone on the way back; Postgres keeps it.
    assert {**read, "updated_at": None} == {**body, "updated_at": None}
    assert actions(db, patient.id) == ["patient.clinical.update", "patient.clinical.read"]


def test_saving_again_replaces_the_treatments(db, client_as):
    patient = add_patient(db)
    member = uuid.uuid4()
    assign(db, member, patient.id)
    client = client_as(Role.PROFESSIONAL, member)
    client.put(url(patient.id), json=PROFILE)

    client.put(url(patient.id), json={"cancer_site": "lung", "treatments": []})

    body = client.get(url(patient.id)).json()
    assert body["cancer_site"] == "lung"
    assert body["height_cm"] is None
    assert body["treatments"] == []
    assert db.scalars(select(Treatment)).all() == []


def test_empty_profile_before_anyone_fills_it(db, client_as):
    patient = add_patient(db)
    member = uuid.uuid4()
    assign(db, member, patient.id)

    body = client_as(Role.COORDINATOR, member).get(url(patient.id)).json()

    assert body["updated_at"] is None
    assert body["treatments"] == []


def test_patient_reads_own_profile_but_cannot_change_it(db, client_as):
    account = uuid.uuid4()
    patient = add_patient(db, user_id=account)
    member = uuid.uuid4()
    assign(db, member, patient.id)
    client_as(Role.PROFESSIONAL, member).put(url(patient.id), json=PROFILE)
    client = client_as(Role.PATIENT, account)

    assert client.get(url(patient.id)).json()["cancer_site"] == "breast"
    assert client.put(url(patient.id), json=PROFILE).status_code == 403
    assert "patient.clinical.update.denied" in actions(db, patient.id)


@pytest.mark.parametrize("role", [Role.SECRETARY, Role.ADMIN, Role.PROFESSIONAL, Role.PATIENT])
def test_others_are_denied_and_audited(db, client_as, role):
    patient = add_patient(db)
    client = client_as(role)

    assert client.get(url(patient.id)).status_code == 403
    assert client.put(url(patient.id), json=PROFILE).status_code == 403
    assert actions(db, patient.id) == [
        "patient.clinical.read.denied",
        "patient.clinical.update.denied",
    ]


def test_treatment_cannot_end_before_it_starts(db, client_as):
    patient = add_patient(db)
    member = uuid.uuid4()
    assign(db, member, patient.id)
    bad = {
        "treatments": [
            {
                "kind": "radiotherapy",
                "status": "finished",
                "started_on": "2025-05-01",
                "ended_on": "2025-04-01",
            }
        ]
    }

    response = client_as(Role.PROFESSIONAL, member).put(url(patient.id), json=bad)

    assert response.status_code == 422


def test_unknown_patient_is_not_found(client_as):
    response = client_as(Role.COORDINATOR).get(url(uuid.uuid4()))
    assert response.status_code == 404
