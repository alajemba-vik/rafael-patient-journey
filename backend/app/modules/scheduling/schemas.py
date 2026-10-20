"""Request/response shapes for appointments."""

import uuid
from datetime import datetime
from typing import Self

from pydantic import AwareDatetime, BaseModel, model_validator

from app.modules.scheduling.models import AppointmentStatus


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    # A practitioner or coordinator in the patient's care team.
    professional_id: uuid.UUID
    starts_at: AwareDatetime
    ends_at: AwareDatetime

    @model_validator(mode="after")
    def check_order(self) -> Self:
        if self.ends_at <= self.starts_at:
            raise ValueError("The appointment must end after it starts")
        return self


class AppointmentOut(BaseModel):
    """Administrative view: who, with whom, when, and where it stands. Nothing clinical."""

    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    professional_id: uuid.UUID
    professional_name: str
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
