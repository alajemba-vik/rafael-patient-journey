import uuid

from fastapi import APIRouter, Depends, status
from pydantic import AwareDatetime
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.scheduling import service
from app.modules.scheduling.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.create_appointment(db, user, body)


@router.post("/appointments/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.cancel_appointment(db, user, appointment_id)


@router.get("/appointments/mine")
def list_my_appointments(
    start: AwareDatetime | None = None,
    end: AwareDatetime | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentOut]:
    """Defaults to the coming weeks from now."""
    return service.list_my_appointments(db, user, start, end)


@router.get("/patients/{patient_id}/appointments")
def list_patient_appointments(
    patient_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentOut]:
    return service.list_patient_appointments(db, user, patient_id)
