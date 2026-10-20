"""Request shapes for the reception board. Appointments come back as scheduling's AppointmentOut."""

from pydantic import BaseModel

from app.modules.scheduling.service import AppointmentStatus


class StatusChange(BaseModel):
    """arrived, no_show, done, or back to scheduled to undo a mistake."""

    status: AppointmentStatus
