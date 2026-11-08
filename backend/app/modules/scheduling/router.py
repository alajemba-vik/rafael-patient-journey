import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from pydantic import AwareDatetime
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.scheduling import service
from app.modules.scheduling.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    AppointmentUpdate,
    Availability,
)

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.create_appointment(db, user, body)


@router.post("/appointments/{appointment_id}/reschedule")
def reschedule_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentReschedule,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.reschedule_appointment(db, user, appointment_id, body)


@router.post("/appointments/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentCancel | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    """The reason is optional; without one it is recorded as "other"."""
    return service.cancel_appointment(db, user, appointment_id, body)


@router.patch("/appointments/{appointment_id}")
def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.update_appointment(db, user, appointment_id, body)


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


@router.get("/professionals/{professional_id}/availability")
def get_availability(
    professional_id: uuid.UUID,
    day: date,
    minutes: int = Query(default=45, ge=15, le=240),
    patient_id: uuid.UUID | None = None,
    ignore_id: uuid.UUID | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Availability:
    return service.get_availability(db, user, professional_id, day, minutes, patient_id, ignore_id)
