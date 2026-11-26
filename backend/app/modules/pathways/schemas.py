"""Request/response shapes for pathways and milestones."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.modules.pathways.models import (
    DISCIPLINES,
    MAX_DISCIPLINES,
    MAX_GOALS,
    MESSAGE_MAX_LENGTH,
    TASK_NOTE_MAX_LENGTH,
    TASK_TITLE_MAX_LENGTH,
    AssessmentTest,
    Goal,
    MilestoneKind,
    PathwayStatus,
    TaskPriority,
    TaskStatus,
)

Score = Annotated[int, Field(ge=0, le=4)]


class Symptom(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Intensity from 0 (none) to 10 (worst imaginable).
    intensity: int = Field(ge=0, le=10)


class PathwayOpen(BaseModel):
    patient_id: uuid.UUID


def _known_disciplines(codes: list[str]) -> list[str]:
    unknown = [code for code in codes if code not in DISCIPLINES]
    if unknown:
        raise ValueError(f"Unknown disciplines: {', '.join(unknown)}")
    if len(set(codes)) != len(codes):
        raise ValueError("Each discipline once")
    return codes


def _distinct(goals: list[Goal]) -> list[Goal]:
    if len(set(goals)) != len(goals):
        raise ValueError("Each goal once")
    return goals


Goals = Annotated[list[Goal], Field(max_length=MAX_GOALS), AfterValidator(_distinct)]
Disciplines = Annotated[
    list[str], Field(max_length=MAX_DISCIPLINES), AfterValidator(_known_disciplines)
]


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
    goal_codes: Goals = []
    discipline_codes: Disciplines = []


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
    goal_codes: list[Goal]
    discipline_codes: list[str]


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


class NeedCreate(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class NeedOut(BaseModel):
    """A flagged need, as the coordinator sees it in their inbox."""

    id: uuid.UUID
    pathway_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    raised_by_name: str
    raised_at: datetime
    note: str
    resolved_at: datetime | None


class MessageCreate(BaseModel):
    body: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MESSAGE_MAX_LENGTH)
    ]


class MessageOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    # True when the patient wrote it, false when a member of the care team did.
    from_patient: bool
    body: str
    sent_at: datetime


class AssessmentRecord(BaseModel):
    kind: MilestoneKind
    test: AssessmentTest
    value: float = Field(ge=0)


class AssessmentOut(BaseModel):
    kind: MilestoneKind
    test: AssessmentTest
    value: float
    # How the score reads, e.g. "moderate" for a K10 of 27; None for tests without bands.
    band: str | None
    recorded_by_name: str
    recorded_at: datetime


def _blank_to_none(value: str | None) -> str | None:
    return value or None


class TaskCreate(BaseModel):
    title: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=TASK_TITLE_MAX_LENGTH),
    ]
    note: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=TASK_NOTE_MAX_LENGTH),
        AfterValidator(_blank_to_none),
    ] = None
    patient_id: uuid.UUID | None = None
    assigned_to: uuid.UUID
    priority: TaskPriority = TaskPriority.MEDIUM
    due_on: date | None = None


class TaskStatusChange(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    note: str | None
    patient_id: uuid.UUID | None
    patient_name: str | None
    assigned_to: uuid.UUID
    assigned_to_name: str
    created_by: uuid.UUID
    created_by_name: str
    priority: TaskPriority
    status: TaskStatus
    due_on: date | None
    created_at: datetime
    done_at: datetime | None


class Assignee(BaseModel):
    """Someone a task can be given to."""

    id: uuid.UUID
    full_name: str
    role: str
    discipline: str | None
