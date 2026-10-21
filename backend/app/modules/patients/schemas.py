import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, computed_field


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: date
    email: EmailStr | None = None
    phone: str | None = None
    # The patient's own login, created beforehand by an admin. Optional.
    user_id: uuid.UUID | None = None


class PatientAdministrative(BaseModel):
    """What reception and admins may see."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    birth_date: date
    email: str | None
    phone: str | None
    user_id: uuid.UUID | None = None

    @computed_field
    @property
    def has_account(self) -> bool:
        """Whether the patient can log in to the patient portal."""
        return self.user_id is not None


class PatientUpdate(BaseModel):
    """Contact details, or the patient's login once an admin has created it. All optional."""

    email: EmailStr | None = None
    phone: str | None = None
    user_id: uuid.UUID | None = None


class PatientDetail(PatientAdministrative):
    """Administrative + clinical data: the patient themself and their care team."""

    medical_summary: str | None
