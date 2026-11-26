import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.questionnaires import service
from app.modules.questionnaires.models import Instrument
from app.modules.questionnaires.schemas import (
    PatientRating,
    PractitionerRating,
    Questionnaire,
    ResponseCreate,
    ScoreOut,
    SessionOut,
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


@router.get("/sessions/to-rate")
def list_sessions_to_rate(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SessionOut]:
    """The patient's recent finished sessions still waiting for their rating."""
    return service.list_sessions_to_rate(db, user)


@router.post("/sessions/{appointment_id}/patient-rating")
def rate_session_as_patient(
    appointment_id: uuid.UUID,
    body: PatientRating,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    return service.rate_session_as_patient(db, user, appointment_id, body)


@router.post("/sessions/{appointment_id}/practitioner-rating")
def rate_session_as_practitioner(
    appointment_id: uuid.UUID,
    body: PractitionerRating,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    return service.rate_session_as_practitioner(db, user, appointment_id, body)


@router.get("/patients/{patient_id}/sessions")
def list_patient_sessions(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SessionOut]:
    return service.list_patient_sessions(db, user, patient_id)
