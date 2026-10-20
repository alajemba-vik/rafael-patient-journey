"""Response shapes for the dashboard. Every average is None when too few patients are behind it."""

from datetime import date, datetime

from pydantic import BaseModel


class Attendance(BaseModel):
    since: date
    done: int
    no_show: int
    no_show_rate: float | None


class MonthlyScore(BaseModel):
    period: str
    respondents: int
    average: float | None


class QuestionAverage(BaseModel):
    question: str
    average: float | None


class Satisfaction(BaseModel):
    respondents: int
    average: float | None
    by_question: list[QuestionAverage]


class DimensionChange(BaseModel):
    dimension: str
    average_change: float | None


class SelfAssessment(BaseModel):
    """Final review minus intake, on the 0–4 self-assessment, over finished pathways."""

    pathways: int
    by_dimension: list[DimensionChange]


class Dashboard(BaseModel):
    generated_at: datetime
    min_group_size: int
    active_pathways: int
    attendance: Attendance
    quality_of_life: list[MonthlyScore]
    satisfaction: Satisfaction
    self_assessment: SelfAssessment
