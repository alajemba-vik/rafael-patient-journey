import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.patients import service
from app.modules.patients.schemas import PatientAdministrative, PatientCreate, PatientDetail

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientAdministrative:
    return service.create_patient(db, user, body)


@router.get("")
def list_patients(
    search: str | None = None,
    unassigned: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PatientAdministrative]:
    return service.list_patients(db, user, search, unassigned)


@router.get("/{patient_id}")
def get_patient(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientDetail | PatientAdministrative:
    return service.get_patient(db, user, patient_id)
