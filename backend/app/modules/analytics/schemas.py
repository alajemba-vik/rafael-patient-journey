"""Response shapes for the dashboard.

Every count and average about patients is None when it covers too few of them to stay anonymous.
"""

from datetime import date, datetime

from pydantic import BaseModel


class Attendance(BaseModel):
    since: date
    done: int | None
    no_show: int | None
    no_show_rate: float | None


class MonthlyScore(BaseModel):
    period: str
    respondents: int | None
    average: float | None


class QuestionAverage(BaseModel):
    question: str
    average: float | None


class Satisfaction(BaseModel):
    respondents: int | None
    average: float | None
    by_question: list[QuestionAverage]


class DimensionChange(BaseModel):
    dimension: str
    average_change: float | None


class SelfAssessment(BaseModel):
    """Final review minus intake, on the 0–4 self-assessment, over finished pathways."""

    pathways: int | None
    by_dimension: list[DimensionChange]


class Dashboard(BaseModel):
    generated_at: datetime
    min_group_size: int
    active_pathways: int
    attendance: Attendance
    quality_of_life: list[MonthlyScore]
    satisfaction: Satisfaction
    self_assessment: SelfAssessment
