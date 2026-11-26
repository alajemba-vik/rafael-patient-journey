import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.pathways import service
from app.modules.pathways.schemas import (
    AssessmentOut,
    AssessmentRecord,
    Assignee,
    MessageCreate,
    MessageOut,
    MilestoneCreate,
    NeedCreate,
    NeedOut,
    PathwayOpen,
    PathwayOut,
    PathwaySummary,
    PatientPathway,
    TaskCreate,
    TaskOut,
    TaskStatusChange,
)

router = APIRouter(prefix="/pathways", tags=["pathways"])


@router.post("", status_code=status.HTTP_201_CREATED)
def open_pathway(
    body: PathwayOpen,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PathwayOut:
    return service.open_pathway(db, user, body)


@router.post("/{pathway_id}/milestones", status_code=status.HTTP_201_CREATED)
def record_milestone(
    pathway_id: uuid.UUID,
    body: MilestoneCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PathwayOut:
    return service.record_milestone(db, user, pathway_id, body)


@router.post("/{pathway_id}/close")
def close_pathway(
    pathway_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PathwayOut:
    return service.close_pathway(db, user, pathway_id)


@router.get("/mine")
def list_my_pathways(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PatientPathway]:
    return service.list_my_pathways(db, user)


@router.get("/led")
def list_led_pathways(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PathwaySummary]:
    """A coordinator's open pathways, with the next milestone due."""
    return service.list_led_pathways(db, user)


@router.get("/patients/{patient_id}")
def list_patient_pathways(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PathwayOut]:
    return service.list_patient_pathways(db, user, patient_id)


@router.post("/{pathway_id}/needs", status_code=status.HTTP_201_CREATED)
def raise_need(
    pathway_id: uuid.UUID,
    body: NeedCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NeedOut:
    return service.raise_need(db, user, pathway_id, body)


@router.get("/needs")
def list_open_needs(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[NeedOut]:
    """The coordinator's inbox of needs flagged by practitioners."""
    return service.list_open_needs(db, user)


@router.post("/needs/{need_id}/resolve")
def resolve_need(
    need_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NeedOut:
    return service.resolve_need(db, user, need_id)


@router.get("/messages/mine")
def list_my_messages(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[MessageOut]:
    return service.list_my_messages(db, user)


@router.post("/messages/mine", status_code=status.HTTP_201_CREATED)
def send_my_message(
    body: MessageCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    return service.send_my_message(db, user, body)


@router.get("/patients/{patient_id}/messages")
def list_messages(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    return service.list_messages(db, user, patient_id)


@router.post("/patients/{patient_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(
    patient_id: uuid.UUID,
    body: MessageCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    return service.send_message(db, user, patient_id, body)


@router.post("/{pathway_id}/assessments")
def record_assessment(
    pathway_id: uuid.UUID,
    body: AssessmentRecord,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssessmentOut:
    """Record one test of the assessment day; recording it again replaces the score."""
    return service.record_assessment(db, user, pathway_id, body)


@router.get("/patients/{patient_id}/assessments")
def list_patient_assessments(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssessmentOut]:
    return service.list_patient_assessments(db, user, patient_id)


@router.get("/tasks/assignees")
def list_task_assignees(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Assignee]:
    return service.list_assignees(db, user)


@router.get("/tasks")
def list_tasks(
    given: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    return service.list_tasks(db, user, given)


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    return service.create_task(db, user, body)


@router.post("/tasks/{task_id}/status")
def change_task_status(
    task_id: uuid.UUID,
    body: TaskStatusChange,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    return service.change_task_status(db, user, task_id, body.status)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_task(db, user, task_id)
