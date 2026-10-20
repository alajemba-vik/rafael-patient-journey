import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.pathways import service
from app.modules.pathways.schemas import (
    MilestoneCreate,
    PathwayOpen,
    PathwayOut,
    PathwaySummary,
    PatientPathway,
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
