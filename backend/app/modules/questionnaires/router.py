import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.questionnaires import service
from app.modules.questionnaires.models import Instrument
from app.modules.questionnaires.schemas import (
    Questionnaire,
    ResponseCreate,
    ScoreOut,
    SubmittedOut,
)

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


@router.get("/due")
def list_due(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Questionnaire]:
    """The patient's questionnaires to answer now, with their questions and choices."""
    return service.list_due(db, user)


@router.post("/{instrument}/responses", status_code=status.HTTP_201_CREATED)
def submit_response(
    instrument: Instrument,
    body: ResponseCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmittedOut:
    return service.submit_response(db, user, instrument, body)


@router.get("/scores/mine")
def list_my_scores(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ScoreOut]:
    return service.list_my_scores(db, user)


@router.get("/patients/{patient_id}/scores")
def list_patient_scores(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScoreOut]:
    return service.list_patient_scores(db, user, patient_id)
