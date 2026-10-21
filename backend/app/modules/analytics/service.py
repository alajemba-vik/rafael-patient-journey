"""De-identified indicators for the patient-experience dashboard.

Built only from other modules' totals (through their service.py); nothing here can point to
one patient. Any count or average over fewer than MIN_GROUP_SIZE patients is hidden: in a small
team, "one absence" or "one respondent" can be enough to tell who.
"""

from datetime import UTC, datetime, timedelta
from statistics import mean

from sqlalchemy.orm import Session

from app.errors import ForbiddenError
from app.modules.analytics.schemas import (
    Attendance,
    Dashboard,
    DimensionChange,
    MonthlyScore,
    QuestionAverage,
    Satisfaction,
    SelfAssessment,
)
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.pathways import service as pathways
from app.modules.questionnaires import service as questionnaires
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.service import AppointmentStatus

# The brief asks for dashboards for professionals; admins see the same de-identified view.
DASHBOARD_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR, Role.ADMIN}
# TODO(validate): the smallest group the Institute is comfortable showing an average for.
MIN_GROUP_SIZE = 5
ATTENDANCE_WINDOW = timedelta(days=90)
QUALITY_OF_LIFE_MONTHS = 12


def get_dashboard(db: Session, user: CurrentUser) -> Dashboard:
    if user.role not in DASHBOARD_ROLES:
        raise ForbiddenError("Only care staff and admins see the dashboard")
    now = datetime.now(UTC)
    return Dashboard(
        generated_at=now,
        min_group_size=MIN_GROUP_SIZE,
        active_pathways=pathways.count_open(db),
        attendance=_attendance(db, now),
        quality_of_life=_quality_of_life(db, now),
        satisfaction=_satisfaction(db),
        self_assessment=_self_assessment(db),
    )


def _attendance(db: Session, now: datetime) -> Attendance:
    since = now - ATTENDANCE_WINDOW
    counts = scheduling.count_by_status(db, since, now)
    done = counts.get(AppointmentStatus.DONE, 0)
    no_show = counts.get(AppointmentStatus.NO_SHOW, 0)
    seen = done + no_show
    return Attendance(
        since=since.date(),
        done=_count(seen, done),
        no_show=_count(seen, no_show),
        no_show_rate=_shown(seen, no_show / seen * 100 if seen else None),
    )


def _quality_of_life(db: Session, now: datetime) -> list[MonthlyScore]:
    """The last QUALITY_OF_LIFE_MONTHS months, this one included."""
    months_back = now.year * 12 + now.month - QUALITY_OF_LIFE_MONTHS
    first_month = f"{months_back // 12:04d}-{months_back % 12 + 1:02d}"
    return [
        MonthlyScore(
            period=period, respondents=_count(count, count), average=_shown(count, average)
        )
        for period, count, average in questionnaires.monthly_quality_of_life(db, first_month)
    ]


def _satisfaction(db: Session) -> Satisfaction:
    answers = questionnaires.satisfaction_answers(db)
    count = len(answers)
    questions = questionnaires.QUESTIONNAIRES[questionnaires.Instrument.SATISFACTION].questions
    by_question = [
        QuestionAverage(
            question=question.text,
            average=_shown(count, _out_of_100([a[question.id] for a in answers])),
        )
        for question in questions
    ]
    overall = _out_of_100([value for a in answers for value in a.values()])
    return Satisfaction(
        respondents=_count(count, count), average=_shown(count, overall), by_question=by_question
    )


def _self_assessment(db: Session) -> SelfAssessment:
    count, changes = pathways.average_self_assessment_change(db)
    return SelfAssessment(
        pathways=_count(count, count),
        by_dimension=[
            DimensionChange(dimension=dimension, average_change=_shown(count, change))
            for dimension, change in changes.items()
        ],
    )


def _out_of_100(values: list[int]) -> float | None:
    """0–4 answers as a 0–100 score, like the questionnaires' own scores."""
    return mean(values) / 4 * 100 if values else None


def _count(group_size: int, value: int) -> int | None:
    """The count, or None when the group is too small to stay anonymous."""
    return value if group_size >= MIN_GROUP_SIZE else None


def _shown(group_size: int, value: float | None) -> float | None:
    """The value, rounded, or None when the group is too small to stay anonymous."""
    if value is None or group_size < MIN_GROUP_SIZE:
        return None
    return round(value, 1)
