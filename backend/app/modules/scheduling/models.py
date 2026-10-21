import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppointmentStatus(StrEnum):
    """The one lifecycle every module reads: reception moves it, analytics counts it."""

    SCHEDULED = "scheduled"
    ARRIVED = "arrived"
    DONE = "done"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class Appointment(Base):
    """A patient meeting one care-team member: a practitioner session or a coordinator review."""

    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_professional_start", "professional_id", "starts_at"),
        Index("ix_appointments_patient_start", "patient_id", "starts_at"),
        CheckConstraint("ends_at > starts_at", name="ck_appointments_ends_after_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)  # id only: no cross-module FK
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(
            AppointmentStatus,
            native_enum=False,
            length=16,
            values_callable=lambda s: [m.value for m in s],
        ),
        default=AppointmentStatus.SCHEDULED,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
