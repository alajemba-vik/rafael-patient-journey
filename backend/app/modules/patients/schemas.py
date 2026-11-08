import re
import uuid
from datetime import date
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    StringConstraints,
    computed_field,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]

EARLIEST_BIRTH_DATE = date(1900, 1, 1)
FRANCE_CODE = "33"


def normalize_phone(value: str | None) -> str | None:
    """One stored form per number, so a phone search finds the patient however it was typed.

    French numbers are kept the way they're read out, "0612345678", whether typed as
    "06 12…", "+33 6 12…" or "0033 6 12…"; other countries keep their prefix, "+41…".
    Empty means no phone.
    """
    if value is None or not value.strip():
        return None
    digits = re.sub(r"\D", "", value)
    international = value.strip().startswith("+") or digits.startswith("00")
    if digits.startswith("00"):
        digits = digits[2:]
    if not 6 <= len(digits) <= 15:
        raise ValueError("A phone number has 6 to 15 digits")
    if international and digits.startswith("0"):
        raise ValueError("No country code starts with 0")
    if international and digits.startswith(FRANCE_CODE) and len(digits) == 11:
        return "0" + digits[len(FRANCE_CODE) :]
    return f"+{digits}" if international else digits


def check_birth_date(value: date) -> date:
    if not EARLIEST_BIRTH_DATE <= value <= date.today():
        raise ValueError("The birth date must be in the past and after 1900")
    return value


Phone = Annotated[str | None, AfterValidator(normalize_phone)]
BirthDate = Annotated[date, AfterValidator(check_birth_date)]


class PatientCreate(BaseModel):
    first_name: Name
    last_name: Name
    birth_date: BirthDate
    email: EmailStr | None = None
    phone: Phone = None
    # The patient's own login, created beforehand by an admin. Optional.
    user_id: uuid.UUID | None = None
    # Someone with the same name and birth date is already registered, and reception has
    # checked it is a different person.
    allow_duplicate: bool = False


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
    """Corrections to the administrative record, or the patient's login once an admin has
    created it. Only the fields sent change."""

    first_name: Name | None = None
    last_name: Name | None = None
    birth_date: BirthDate | None = None
    email: EmailStr | None = None
    phone: Phone = None
    user_id: uuid.UUID | None = None


class PatientDetail(PatientAdministrative):
    """Administrative + clinical data: the patient themself and their care team."""

    medical_summary: str | None
