import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ShareReason(StrEnum):
    """Why someone was given the patient's file, as in the Institute's current tool."""

    CARE_TEAM = "care_team"  # joins the care team
    CONVOCATION = "convocation"  # to call the patient in
    BOOKING = "booking"  # to book appointments
    MEDICAL_OPINION = "medical_opinion"  # for a medical opinion
    ADMINISTRATIVE = "administrative"  # paperwork
    FILE_MERGE = "file_merge"  # to merge duplicate files


SHARE_NOTE_MAX_LENGTH = 500


class CareAssignment(Base):
    """A professional or coordinator taking part in a patient's care."""

    __tablename__ = "care_assignments"
    __table_args__ = (UniqueConstraint("patient_id", "professional_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # id only: no cross-module FK. Indexed through the unique constraint, which starts with it.
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    # Who shared the file, when and why. Empty for assignments made before this was recorded.
    reason: Mapped[ShareReason | None] = mapped_column(
        Enum(
            ShareReason,
            native_enum=False,
            length=32,
            values_callable=lambda e: [m.value for m in e],
        )
    )
    note: Mapped[str | None] = mapped_column(String(SHARE_NOTE_MAX_LENGTH))
    added_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    added_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
