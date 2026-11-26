import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
)
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


class SessionEvaluation(Base):
    """How one finished session went, from both sides.

    The patient rates the difficulty they felt and their satisfaction, each 0 to 4. The
    practitioner records how well the patient coped, 0 (could not do it) to 4 (at ease), and
    for physical activity the session's intensity in METs. Either side may be missing.
    """

    __tablename__ = "session_evaluations"
    __table_args__ = (
        CheckConstraint(
            "patient_difficulty IS NULL OR patient_difficulty BETWEEN 0 AND 4",
            name="ck_session_evaluations_difficulty_range",
        ),
        CheckConstraint(
            "patient_satisfaction IS NULL OR patient_satisfaction BETWEEN 0 AND 4",
            name="ck_session_evaluations_satisfaction_range",
        ),
        CheckConstraint(
            "coping IS NULL OR coping BETWEEN 0 AND 4", name="ck_session_evaluations_coping_range"
        ),
        CheckConstraint(
            "intensity_mets IS NULL OR intensity_mets BETWEEN 0.5 AND 25",
            name="ck_session_evaluations_mets_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # ids only: no cross-module FK.
    appointment_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    patient_difficulty: Mapped[int | None] = mapped_column(SmallInteger)
    patient_satisfaction: Mapped[int | None] = mapped_column(SmallInteger)
    patient_rated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    coping: Mapped[int | None] = mapped_column(SmallInteger)
    intensity_mets: Mapped[float | None] = mapped_column(Float)
    practitioner_rated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
