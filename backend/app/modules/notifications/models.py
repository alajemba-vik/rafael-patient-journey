"""Tables: Notification, one message for one user, shown in the app."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import JSON, CheckConstraint, DateTime, Enum, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Template(StrEnum):
    """What happened. The interface turns the template and its parameters into a sentence."""

    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_MOVED = "appointment_moved"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_REMINDER = "appointment_reminder"
    MISSED_APPOINTMENT = "missed_appointment"
    MESSAGE_RECEIVED = "message_received"
    SESSION_TO_RATE = "session_to_rate"
    TASK_ASSIGNED = "task_assigned"


class Channel(StrEnum):
    """Where a notification is shown. Only the in-app inbox: no email or SMS is sent."""

    IN_APP = "in_app"


class Status(StrEnum):
    UNREAD = "unread"
    READ = "read"


def _values(enum: type[StrEnum]) -> list[str]:
    return [member.value for member in enum]


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_sent", "recipient_id", "sent_at"),
        CheckConstraint(
            f"status IN {tuple(_values(Status))}", name="ck_notifications_status_valid"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(Uuid)  # a user id, no cross-module FK
    channel: Mapped[Channel] = mapped_column(
        Enum(Channel, native_enum=False, length=16, values_callable=_values),
        default=Channel.IN_APP,
    )
    template: Mapped[Template] = mapped_column(
        Enum(Template, native_enum=False, length=32, values_callable=_values)
    )
    # What it is about (an appointment, a patient's thread), so the interface can link to it
    # and a reminder is never sent twice.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    # Dates and staff names only: never health details, never a patient's name.
    params: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    status: Mapped[Status] = mapped_column(
        Enum(Status, native_enum=False, length=16, values_callable=_values),
        default=Status.UNREAD,
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
