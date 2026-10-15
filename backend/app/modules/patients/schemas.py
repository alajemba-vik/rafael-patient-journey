import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: date
    email: EmailStr | None = None
    phone: str | None = None


class PatientAdministrative(BaseModel):
    """What reception and admins may see."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    birth_date: date
    email: str | None
    phone: str | None


class PatientDetail(PatientAdministrative):
    """Administrative + clinical data: the patient themself and their care team."""

    medical_summary: str | None
