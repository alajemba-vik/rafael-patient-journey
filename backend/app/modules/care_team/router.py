import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.care_team import service
from app.modules.care_team.schemas import AssignmentCreate, AssignmentOut, CareTeamMember
from app.modules.identity_access.service import CurrentUser, get_current_user

router = APIRouter(prefix="/care-team", tags=["care_team"])


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    return service.create_assignment(db, user, body)


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_assignment(db, user, assignment_id)


@router.get("/patients/{patient_id}/members")
def list_members(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CareTeamMember]:
    return service.list_members(db, user, patient_id)
