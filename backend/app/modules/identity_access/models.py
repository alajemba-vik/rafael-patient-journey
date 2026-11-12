import uuid
from enum import StrEnum

from sqlalchemy import Boolean, Enum, String, Uuid, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Role(StrEnum):
    PATIENT = "patient"
    SECRETARY = "secretary"
    PROFESSIONAL = "professional"
    COORDINATOR = "coordinator"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # The user's id in the identity provider (Supabase Auth today).
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(
        Enum(Role, native_enum=False, length=32, values_callable=lambda r: [m.value for m in r])
    )
    # A practitioner's discipline, e.g. "Sophrologie". Coordinators often practise one too.
    discipline: Mapped[str | None] = mapped_column(String(120))
    # A deactivated account keeps its history (audit trail, past sessions) but can't log in.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
