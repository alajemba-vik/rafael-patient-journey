"""Tasks between staff: who may create, see, move and delete them. Synthetic data only."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.audit import AuditEvent
from app.modules.identity_access.service import Role
from app.modules.notifications.models import Notification, Template
from app.modules.pathways.models import Task, TaskStatus
from tests.pathways.test_pathways import add_account, add_patient, assign

URL = "/api/v1/pathways/tasks"


def audit_actions(db) -> list[str]:
    return list(db.scalars(select(AuditEvent.action).order_by(AuditEvent.occurred_at)))


def test_coordinator_gives_a_patient_task_to_a_colleague_in_the_team(db, client_as):
    coordinator = add_account(db, Role.COORDINATOR)
    colleague = add_account(db, Role.PROFESSIONAL, "Nadia Diététique")
    patient = add_patient(db)
    assign(db, coordinator.id, patient.id)
    assign(db, colleague.id, patient.id)

    response = client_as(Role.COORDINATOR, coordinator.id).post(
        URL,
        json={
            "title": "Convocation bilan 3 mois",
            "patient_id": str(patient.id),
            "assigned_to": str(colleague.id),
            "priority": "high",
            "note": "  ",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["patient_name"] == "Alex Synthetic"
    assert body["assigned_to_name"] == "Nadia Diététique"
    assert body["status"] == "todo"
    assert body["note"] is None
    sent = db.scalars(select(Notification).where(Notification.recipient_id == colleague.id))
    assert [n.template for n in sent] == [Template.TASK_ASSIGNED]
    assert "task.create" in audit_actions(db)

    mine = client_as(Role.PROFESSIONAL, colleague.id).get(URL).json()
    given = client_as(Role.COORDINATOR, coordinator.id).get(URL, params={"given": True}).json()
    assert [t["id"] for t in mine] == [body["id"]] == [t["id"] for t in given]
    assert client_as(Role.COORDINATOR, coordinator.id).get(URL).json() == []


def test_a_task_for_oneself_without_patient_sends_no_notification(db, client_as):
    secretary = add_account(db, Role.SECRETARY)

    response = client_as(Role.SECRETARY, secretary.id).post(
        URL, json={"title": "Commander des formulaires", "assigned_to": str(secretary.id)}
    )

    assert response.status_code == 201
    assert db.scalars(select(Notification)).all() == []
    assert audit_actions(db) == []


def test_care_staff_outside_the_team_cannot_make_a_task_about_the_patient(db, client_as):
    outsider = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)

    response = client_as(Role.PROFESSIONAL, outsider.id).post(
        URL, json={"title": "X", "patient_id": str(patient.id), "assigned_to": str(outsider.id)}
    )

    assert response.status_code == 403
    assert audit_actions(db) == ["task.create.denied"]


def test_the_assignee_must_be_able_to_see_the_patient(db, client_as):
    secretary = add_account(db, Role.SECRETARY)
    outsider = add_account(db, Role.PROFESSIONAL)
    patient = add_patient(db)

    response = client_as(Role.SECRETARY, secretary.id).post(
        URL, json={"title": "X", "patient_id": str(patient.id), "assigned_to": str(outsider.id)}
    )

    assert response.status_code == 409


@pytest.mark.parametrize("role", [Role.PATIENT, Role.ADMIN])
def test_patients_and_admins_do_not_use_tasks(db, client_as, role):
    target = add_account(db, Role.SECRETARY)
    client = client_as(role)

    assert client.get(URL).status_code == 403
    assert client.post(URL, json={"title": "X", "assigned_to": str(target.id)}).status_code == 403


def test_cannot_give_a_task_to_a_patient_account(db, client_as):
    secretary = add_account(db, Role.SECRETARY)
    patient_account = add_account(db, Role.PATIENT)

    response = client_as(Role.SECRETARY, secretary.id).post(
        URL, json={"title": "X", "assigned_to": str(patient_account.id)}
    )

    assert response.status_code == 404


def make_task(db, creator, assignee, patient_id=None, **fields) -> Task:
    task = Task(
        title="Rappeler",
        created_by=creator,
        assigned_to=assignee,
        patient_id=patient_id,
        created_at=datetime.now(UTC),
        **fields,
    )
    db.add(task)
    db.commit()
    return task


def test_the_assignee_moves_the_task_and_done_records_when(db, client_as):
    creator, assignee = add_account(db, Role.SECRETARY), add_account(db, Role.COORDINATOR)
    task = make_task(db, creator.id, assignee.id)
    client = client_as(Role.COORDINATOR, assignee.id)

    started = client.post(f"{URL}/{task.id}/status", json={"status": "in_progress"}).json()
    done = client.post(f"{URL}/{task.id}/status", json={"status": "done"}).json()
    reopened = client.post(f"{URL}/{task.id}/status", json={"status": "todo"}).json()

    assert started["done_at"] is None
    assert done["status"] == "done" and done["done_at"] is not None
    assert reopened["done_at"] is None


def test_someone_else_cannot_move_or_delete_a_patient_task(db, client_as):
    creator, assignee = add_account(db, Role.SECRETARY), add_account(db, Role.SECRETARY)
    patient = add_patient(db)
    task = make_task(db, creator.id, assignee.id, patient.id)
    stranger = client_as(Role.SECRETARY, uuid.uuid4())

    assert stranger.post(f"{URL}/{task.id}/status", json={"status": "done"}).status_code == 403
    assert stranger.delete(f"{URL}/{task.id}").status_code == 403
    assert audit_actions(db) == ["task.update.denied", "task.delete.denied"]


def test_only_the_creator_deletes(db, client_as):
    creator, assignee = add_account(db, Role.SECRETARY), add_account(db, Role.SECRETARY)
    task_id = make_task(db, creator.id, assignee.id).id

    assert client_as(Role.SECRETARY, assignee.id).delete(f"{URL}/{task_id}").status_code == 403
    assert client_as(Role.SECRETARY, creator.id).delete(f"{URL}/{task_id}").status_code == 204
    db.expire_all()
    assert db.scalar(select(Task).where(Task.id == task_id)) is None


def test_old_finished_tasks_leave_the_board(db, client_as):
    me = add_account(db, Role.SECRETARY)
    long_ago = datetime.now(UTC) - timedelta(days=30)
    make_task(db, me.id, me.id, status=TaskStatus.DONE, done_at=long_ago)
    recent = make_task(db, me.id, me.id, status=TaskStatus.DONE, done_at=datetime.now(UTC))
    open_task = make_task(db, me.id, me.id)

    ids = {t["id"] for t in client_as(Role.SECRETARY, me.id).get(URL).json()}

    assert ids == {str(recent.id), str(open_task.id)}


def test_listing_tasks_about_patients_is_audited(db, client_as):
    me = add_account(db, Role.SECRETARY)
    patient = add_patient(db)
    make_task(db, me.id, me.id, patient.id)

    client_as(Role.SECRETARY, me.id).get(URL)

    assert audit_actions(db) == ["task.list"]


def test_assignees_are_reception_and_care_staff(db, client_as):
    add_account(db, Role.SECRETARY, "Sam Accueil")
    add_account(db, Role.PROFESSIONAL, "Nadia Diététique")
    add_account(db, Role.ADMIN, "Ada Admin")
    add_account(db, Role.PATIENT, "Paul Patient")

    names = [a["full_name"] for a in client_as(Role.COORDINATOR).get(f"{URL}/assignees").json()]

    assert names == ["Nadia Diététique", "Sam Accueil"]
