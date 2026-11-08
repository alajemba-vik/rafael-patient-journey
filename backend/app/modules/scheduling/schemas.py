"""Request/response shapes for appointments."""

import uuid
from datetime import date, datetime
from typing import Annotated, Self

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints, model_validator

from app.modules.scheduling.models import NOTE_MAX_LENGTH, AppointmentStatus, CancelReason


class _TimeRange(BaseModel):
    starts_at: AwareDatetime
    ends_at: AwareDatetime

    @model_validator(mode="after")
    def check_order(self) -> Self:
        if self.ends_at <= self.starts_at:
            raise ValueError("The appointment must end after it starts")
        return self


class AppointmentCreate(_TimeRange):
    patient_id: uuid.UUID
    # A practitioner or coordinator in the patient's care team.
    professional_id: uuid.UUID
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=NOTE_MAX_LENGTH)] = ""


class AppointmentReschedule(_TimeRange):
    """A new time with the same practitioner, e.g. when the patient phones to move it."""


class AppointmentCancel(BaseModel):
    reason: CancelReason = CancelReason.OTHER


class AppointmentUpdate(BaseModel):
    """The staff note on an appointment. An empty string clears it."""

    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=NOTE_MAX_LENGTH)]


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
    arrived_at: datetime | None = None
    called_in_at: datetime | None = None
    cancel_reason: CancelReason | None = None
    # Staff only: left empty in the patient's own views.
    note: str | None = None


class TimeSlot(BaseModel):
    starts_at: datetime
    ends_at: datetime


class Availability(BaseModel):
    """One practitioner's day: when they are taken, and where a session of the asked length fits.

    Busy slots carry no patient names, so anyone booking sees only what booking needs.
    """

    day: date
    minutes: int = Field(description="Length of the session the free slots were computed for")
    busy: list[TimeSlot]
    free: list[TimeSlot]
