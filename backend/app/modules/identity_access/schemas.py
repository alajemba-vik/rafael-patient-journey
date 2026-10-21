import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.identity_access.models import Role


class UserCreate(BaseModel):
    """A new login. The initial password is set by whoever creates the account."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=12, max_length=128)
    role: Role
    discipline: str | None = Field(default=None, max_length=120)


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
