import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, DateTime, Enum, Float, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Instrument(StrEnum):
    QUALITY_OF_LIFE = "quality_of_life"  # monthly while a pathway is open
    SATISFACTION = "satisfaction"  # once, at the end of a pathway


class QuestionnaireResponse(Base):
    """One completed questionnaire. `period` makes each one answerable once: the month
    ("2026-10") for quality of life, the pathway id for satisfaction."""

    __tablename__ = "questionnaire_responses"
    __table_args__ = (UniqueConstraint("patient_id", "instrument", "period"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # id only: no cross-module FK. Indexed through the unique constraint, which starts with it.
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    instrument: Mapped[Instrument] = mapped_column(
        Enum(
            Instrument,
            native_enum=False,
            length=24,
            values_callable=lambda e: [m.value for m in e],
        )
    )
    period: Mapped[str] = mapped_column(String(64))
    answers: Mapped[dict[str, int]] = mapped_column(JSON)
    # 0 to 100, higher is better.
    score: Mapped[float] = mapped_column(Float)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
