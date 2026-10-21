import uuid

from sqlalchemy import UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CareAssignment(Base):
    """A professional or coordinator taking part in a patient's care."""

    __tablename__ = "care_assignments"
    __table_args__ = (UniqueConstraint("patient_id", "professional_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # id only: no cross-module FK. Indexed through the unique constraint, which starts with it.
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    professional_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
