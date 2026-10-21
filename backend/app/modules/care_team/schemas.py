"""Request/response shapes for care-team assignments."""

import uuid

from pydantic import BaseModel, ConfigDict

from app.modules.identity_access.service import Role


class AssignmentCreate(BaseModel):
    patient_id: uuid.UUID
    # A professional or coordinator account.
    professional_id: uuid.UUID


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    professional_id: uuid.UUID


class CareTeamMember(BaseModel):
    assignment_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    role: Role
