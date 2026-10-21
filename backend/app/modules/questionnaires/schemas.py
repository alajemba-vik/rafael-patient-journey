"""Request/response shapes for questionnaires and answers."""

import uuid
from datetime import datetime

from pydantic import BaseModel

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
