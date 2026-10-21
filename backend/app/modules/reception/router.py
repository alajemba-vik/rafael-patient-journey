import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.reception import service
from app.modules.reception.schemas import StatusChange
from app.modules.scheduling.service import AppointmentOut

router = APIRouter(prefix="/reception", tags=["reception"])


@router.get("/today")
def list_today(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[AppointmentOut]:
    return service.list_today(db, user)


@router.post("/appointments/{appointment_id}/status")
def change_status(
    appointment_id: uuid.UUID,
    body: StatusChange,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    return service.change_status(db, user, appointment_id, body.status)
