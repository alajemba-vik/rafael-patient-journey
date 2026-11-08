"""Request shapes for the reception board. Appointments come back as scheduling's AppointmentOut."""

from pydantic import BaseModel

from app.modules.scheduling.service import AppointmentStatus


class StatusChange(BaseModel):
    """arrived, in_session, done, no_show, or one step back to undo a mistake."""

    status: AppointmentStatus
