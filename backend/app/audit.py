"""Audit trail: who read or changed which patient's data, and when.

Call `record()` from a service whenever patient data is read or written.
Rows are only ever inserted, never updated or deleted.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, Uuid
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    action: Mapped[str] = mapped_column(String(64))  # e.g. "patient.read", "patient.create"
    patient_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)


def record(db: Session, actor_id: uuid.UUID, action: str, patient_id: uuid.UUID | None) -> None:
    """Add an audit event to the current transaction (committed with the caller's work)."""
    db.add(AuditEvent(actor_id=actor_id, action=action, patient_id=patient_id))


def record_many(db: Session, actor_id: uuid.UUID, action: str, patient_ids: set[uuid.UUID]) -> None:
    """One event per patient shown in a list, so "who saw this patient" stays answerable."""
    db.add_all(AuditEvent(actor_id=actor_id, action=action, patient_id=p) for p in patient_ids)
