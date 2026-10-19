import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.identity_access.models import Role


class AccountCreate(BaseModel):
    """A new login. The initial password is set by whoever creates the account."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=12, max_length=128)


class UserCreate(AccountCreate):
    role: Role


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
