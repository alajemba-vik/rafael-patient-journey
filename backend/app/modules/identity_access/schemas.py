import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.identity_access.models import Role


class UserCreate(BaseModel):
    """A new login. The initial password is set by whoever creates the account."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=12, max_length=128)
    role: Role
    discipline: str | None = Field(default=None, max_length=120)


class UserUpdate(BaseModel):
    """Only the fields sent are changed. `discipline` sent as null clears it."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: Role | None = None
    discipline: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    discipline: str | None = None
    is_active: bool = True


class AuditEventOut(BaseModel):
    """One line of the audit trail, with the name of the account that acted."""

    id: uuid.UUID
    occurred_at: datetime
    actor_id: uuid.UUID
    actor_name: str | None
    action: str
    patient_id: uuid.UUID | None
