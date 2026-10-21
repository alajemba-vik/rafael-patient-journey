import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, SmallInteger, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _enum(cls: type[StrEnum], length: int) -> Enum:
    return Enum(
        cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e]
    )


class PathwayStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class MilestoneKind(StrEnum):
    INTAKE = "intake"
    REVIEW = "review"  # around 3 months
    FINAL = "final"  # around 6 months


class CarePathway(Base):
    """A patient's ~6-month pathway, led by a referent coordinator."""

    __tablename__ = "care_pathways"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)  # id only: no cross-module FK
    coordinator_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    status: Mapped[PathwayStatus] = mapped_column(
        _enum(PathwayStatus, 8), default=PathwayStatus.OPEN
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PathwayMilestone(Base):
    """Intake, review or final review: the patient's self-assessment and the agreed plan."""

    __tablename__ = "pathway_milestones"
    __table_args__ = (UniqueConstraint("pathway_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Indexed through the unique constraint, which starts with it.
    pathway_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("care_pathways.id"))
    kind: Mapped[MilestoneKind] = mapped_column(_enum(MilestoneKind, 8))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_by: Mapped[uuid.UUID] = mapped_column(Uuid)

    # Self-assessment, 0 to 4, on the five dimensions the Institute uses.
    physical: Mapped[int] = mapped_column(SmallInteger)
    psychological: Mapped[int] = mapped_column(SmallInteger)
    emotional: Mapped[int] = mapped_column(SmallInteger)
    sexual: Mapped[int] = mapped_column(SmallInteger)
    socio_professional: Mapped[int] = mapped_column(SmallInteger)

    # [{"name": "Fatigue", "intensity": 7}, ...]
    symptoms: Mapped[list[dict]] = mapped_column(JSON, default=list)
    goals: Mapped[str] = mapped_column(Text, default="")
    plan: Mapped[str] = mapped_column(Text, default="")
    # The coordinator's own note: shown to the care team, not to the patient.
    note: Mapped[str] = mapped_column(Text, default="")


class PathwayNeed(Base):
    """A new need a practitioner flags to the referent coordinator, who adjusts the plan."""

    __tablename__ = "pathway_needs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    pathway_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("care_pathways.id"), index=True)
    raised_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str] = mapped_column(Text)
    # Open while these are empty.
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
