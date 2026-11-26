"""Request/response shapes for care-team assignments."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.modules.care_team.models import SHARE_NOTE_MAX_LENGTH, ShareReason
from app.modules.identity_access.service import Role


class AssignmentCreate(BaseModel):
    patient_id: uuid.UUID
    # A professional or coordinator account.
    professional_id: uuid.UUID
    reason: ShareReason = ShareReason.CARE_TEAM
    # Shown in the care team next to the person, e.g. "pour le bilan diététique du 12/01".
    note: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=SHARE_NOTE_MAX_LENGTH),
        AfterValidator(lambda value: value or None),
    ] = None


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
    discipline: str | None
    reason: ShareReason | None = None
    note: str | None = None
    added_by_name: str | None = None
    added_at: datetime | None = None
