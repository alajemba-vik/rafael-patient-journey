"""Request/response shapes for questionnaires and answers."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.modules.questionnaires.models import Instrument


class Choice(BaseModel):
    value: int
    label: str


class Question(BaseModel):
    id: str
    text: str


class Questionnaire(BaseModel):
    """What the patient portal needs to show a questionnaire."""

    instrument: Instrument
    title: str
    introduction: str
    questions: list[Question]
    choices: list[Choice]


class ResponseCreate(BaseModel):
    # {question id: chosen value}
    answers: dict[str, int]


class ScoreOut(BaseModel):
    """One quality-of-life result: 0 to 100, higher is better, with the change since the last."""

    period: str
    score: float
    change: float | None
    submitted_at: datetime


class SubmittedOut(BaseModel):
    id: uuid.UUID
    instrument: Instrument
    score: float
    submitted_at: datetime


Level = Annotated[int, Field(ge=0, le=4)]


class PatientRating(BaseModel):
    """0 = far too easy … 4 = far too hard; 0 = not satisfied … 4 = can't wait to come back."""

    difficulty: Level
    satisfaction: Level


class PractitionerRating(BaseModel):
    """0 = could not do it … 4 = at ease. METs only where intensity is measured."""

    coping: Level
    intensity_mets: Annotated[float, Field(ge=0.5, le=25)] | None = None


class SessionOut(BaseModel):
    """A finished session and its evaluation so far."""

    appointment_id: uuid.UUID
    starts_at: datetime
    professional_id: uuid.UUID
    professional_name: str
    patient_difficulty: int | None
    patient_satisfaction: int | None
    coping: int | None
    intensity_mets: float | None
