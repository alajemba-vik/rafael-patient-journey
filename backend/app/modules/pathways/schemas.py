"""Request/response shapes for pathways and milestones."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.modules.pathways.models import MilestoneKind, PathwayStatus

Score = Annotated[int, Field(ge=0, le=4)]


class Symptom(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # TODO(validate): which intensity scale does the Institute use? (V-11)
    intensity: int = Field(ge=0, le=10)


class PathwayOpen(BaseModel):
    patient_id: uuid.UUID


class MilestoneCreate(BaseModel):
    kind: MilestoneKind
    physical: Score
    psychological: Score
    emotional: Score
    sexual: Score
    socio_professional: Score
    symptoms: list[Symptom] = []
    goals: str = ""
    plan: str = ""
    note: str = ""


class PatientMilestone(BaseModel):
    """A milestone as the patient sees it: everything but the coordinator's note."""

    model_config = ConfigDict(from_attributes=True)

    kind: MilestoneKind
    recorded_at: datetime
    physical: int
    psychological: int
    emotional: int
    sexual: int
    socio_professional: int
    symptoms: list[Symptom]
    goals: str
    plan: str


class Milestone(PatientMilestone):
    """A milestone as the care team sees it."""

    note: str


class PathwayOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    coordinator_id: uuid.UUID
    coordinator_name: str
    status: PathwayStatus
    opened_at: datetime
    closed_at: datetime | None
    milestones: list[Milestone]


class PatientPathway(BaseModel):
    """The patient's own pathway: who their coordinator is and what was recorded together."""

    id: uuid.UUID
    coordinator_name: str
    status: PathwayStatus
    opened_at: datetime
    closed_at: datetime | None
    milestones: list[PatientMilestone]


class PathwaySummary(BaseModel):
    """A row in a coordinator's list: whose pathway, and which milestone comes next and when."""

    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    opened_at: datetime
    next_milestone: MilestoneKind | None
    next_due_on: date | None
