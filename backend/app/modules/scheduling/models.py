import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppointmentStatus(StrEnum):
    """The one lifecycle every module reads: reception moves it, analytics counts it."""

    SCHEDULED = "scheduled"
    ARRIVED = "arrived"  # checked in at reception, in the waiting room
    IN_SESSION = "in_session"  # called in by the practitioner
    DONE = "done"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class CancelReason(StrEnum):
    """Why an appointment was cancelled: tells patient no-notice absences from schedule changes."""

    PATIENT_REQUEST = "patient_request"
    PRACTITIONER_UNAVAILABLE = "practitioner_unavailable"
    OTHER = "other"


def _values(enum: type[StrEnum]) -> list[str]:
    return [member.value for member in enum]


NOTE_MAX_LENGTH = 280


class Appointment(Base):
    """A patient meeting one care-team member: a practitioner session or a coordinator review."""

    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_professional_start", "professional_id", "starts_at"),
        Index("ix_appointments_patient_start", "patient_id", "starts_at"),
        CheckConstraint("ends_at > starts_at", name="ck_appointments_ends_after_start"),
        # The database refuses impossible rows, whichever client writes them.
        CheckConstraint(
            f"status IN {tuple(_values(AppointmentStatus))}", name="ck_appointments_status_valid"
        ),
        CheckConstraint(
            f"cancel_reason IS NULL OR cancel_reason IN {tuple(_values(CancelReason))}",
            name="ck_appointments_cancel_reason_valid",
        ),
        CheckConstraint(
            "cancel_reason IS NULL OR status = 'cancelled'",
            name="ck_appointments_cancel_reason_only_if_cancelled",
        ),
        CheckConstraint(
            "called_in_at IS NULL OR arrived_at IS NOT NULL",
            name="ck_appointments_called_in_after_arrival",
        ),
        # On Postgres, exclusion constraints also refuse overlapping appointments for the same
        # practitioner or patient (migration 9c41d2e7f0ab); SQLite has no equivalent.
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)  # id only: no cross-module FK
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, native_enum=False, length=16, values_callable=_values),
        default=AppointmentStatus.SCHEDULED,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)

    # Waiting room: when the patient checked in, and when they were called in.
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    called_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[CancelReason | None] = mapped_column(
        Enum(CancelReason, native_enum=False, length=32, values_callable=_values)
    )
    # A short administrative note for staff, replacing sticky notes and phone messages
    # ("will be 10 minutes late"). Never clinical information.
    note: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))


class GroupSessionStatus(StrEnum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"


class EnrollmentStatus(StrEnum):
    ENROLLED = "enrolled"
    ATTENDED = "attended"
    NO_SHOW = "no_show"


GROUP_TITLE_MAX_LENGTH = 120
# The upper bound the database accepts; a coach's class is usually 12 at most.
MAX_GROUP_CAPACITY = 30


class GroupSession(Base):
    """A session one practitioner leads for several patients at once: an adapted physical
    activity class, a workshop. Kept apart from appointments, which are one patient each."""

    __tablename__ = "group_sessions"
    __table_args__ = (
        Index("ix_group_sessions_professional_start", "professional_id", "starts_at"),
        CheckConstraint("ends_at > starts_at", name="ck_group_sessions_ends_after_start"),
        CheckConstraint(
            f"capacity BETWEEN 1 AND {MAX_GROUP_CAPACITY}", name="ck_group_sessions_capacity_range"
        ),
        CheckConstraint(
            f"status IN {tuple(_values(GroupSessionStatus))}", name="ck_group_sessions_status_valid"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid)  # id only: no cross-module FK
    title: Mapped[str] = mapped_column(String(GROUP_TITLE_MAX_LENGTH))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[GroupSessionStatus] = mapped_column(
        Enum(GroupSessionStatus, native_enum=False, length=16, values_callable=_values),
        default=GroupSessionStatus.SCHEDULED,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)


class GroupEnrollment(Base):
    """A patient's place in a group session, and whether they came."""

    __tablename__ = "group_enrollments"
    __table_args__ = (
        UniqueConstraint("session_id", "patient_id"),
        CheckConstraint(
            f"status IN {tuple(_values(EnrollmentStatus))}",
            name="ck_group_enrollments_status_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("group_sessions.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)  # id only
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus, native_enum=False, length=16, values_callable=_values),
        default=EnrollmentStatus.ENROLLED,
    )
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
