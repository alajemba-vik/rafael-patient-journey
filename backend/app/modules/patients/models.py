import uuid
from datetime import date

from sqlalchemy import Date, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # The patient's own login account, if they have one.
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)

    # Administrative data: visible to reception and admins.
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32))

    # Clinical data: only the patient and their care team.
    medical_summary: Mapped[str | None] = mapped_column(Text)
