"""Request shapes for the reception board. Appointments come back as scheduling's AppointmentOut."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.modules.scheduling.service import AppointmentStatus


class StatusChange(BaseModel):
    """arrived, in_session, done, no_show, or one step back to undo a mistake."""

    status: AppointmentStatus


class CallBack(BaseModel):
    """A patient to phone: they missed appointments lately."""

    patient_id: uuid.UUID
    patient_name: str
    phone: str | None
    missed: int
    last_missed_at: datetime
    # None: nothing booked, the most urgent case.
    next_appointment_at: datetime | None
