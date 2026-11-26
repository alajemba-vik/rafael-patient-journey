"""Questionnaires: what each patient has to answer, scoring, and results over time.

Nothing is assigned by hand: a quality-of-life questionnaire is due each month while the
patient's pathway is open, and a satisfaction questionnaire once its pathway is closed.

Access policy:
- patient                                → answer their own, see their own quality-of-life scores
- professional or coordinator in the team → the patient's quality-of-life scores
- satisfaction answers                   → nobody individually; analytics shows averages only

Session evaluations, after each finished session:
- patient                                → rate their own session once (difficulty, satisfaction)
- the practitioner who led it            → record how the patient coped and the intensity
- professional or coordinator in the team → every evaluation of the patient's sessions
"""

import uuid
from datetime import UTC, datetime, timedelta
from statistics import mean
from typing import NoReturn
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.config import get_settings
from app.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.pathways import service as pathways
from app.modules.patients import service as patients
from app.modules.questionnaires.models import Instrument, QuestionnaireResponse, SessionEvaluation
from app.modules.questionnaires.schemas import (
    Choice,
    PatientRating,
    PractitionerRating,
    Question,
    Questionnaire,
    ResponseCreate,
    ScoreOut,
    SessionOut,
    SubmittedOut,
)
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.service import AppointmentOut, AppointmentStatus

CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
# A session can be rated by the patient for two weeks: later, nobody remembers how it felt.
RATING_WINDOW = timedelta(days=14)

# Short questionnaires written by the team, not validated instruments. The Institute uses the
# EORTC QLQ-C30, whose questions can't be copied without EORTC's permission.
QUESTIONNAIRES = {
    Instrument.QUALITY_OF_LIFE: Questionnaire(
        instrument=Instrument.QUALITY_OF_LIFE,
        title="Votre qualité de vie ce mois-ci",
        introduction=(
            "Pour chaque point, choisissez la réponse qui décrit le mieux le mois écoulé. "
            "Il n’y a pas de bonne ou de mauvaise réponse."
        ),
        questions=[
            Question(id="energy", text="Votre niveau d’énergie"),
            Question(id="sleep", text="Votre sommeil"),
            Question(id="mood", text="Votre humeur"),
            Question(
                id="daily_activities", text="Votre capacité à faire vos activités du quotidien"
            ),
            Question(id="relationships", text="Vos relations avec vos proches"),
            Question(id="overall", text="Votre qualité de vie en général"),
        ],
        choices=[
            Choice(value=0, label="Très mauvais"),
            Choice(value=1, label="Mauvais"),
            Choice(value=2, label="Moyen"),
            Choice(value=3, label="Bon"),
            Choice(value=4, label="Très bon"),
        ],
    ),
    Instrument.SATISFACTION: Questionnaire(
        instrument=Instrument.SATISFACTION,
        title="Votre avis sur votre parcours",
        introduction=(
            "Votre avis nous aide à améliorer l’accompagnement. Vos réponses ne sont pas "
            "transmises individuellement à votre équipe de soins."
        ),
        questions=[
            Question(id="welcome", text="L’accueil à l’Institut"),
            Question(
                id="coordination", text="L’accompagnement par votre coordinatrice ou coordinateur"
            ),
            Question(id="information", text="Les informations reçues sur votre parcours"),
            Question(id="care", text="Les soins reçus"),
            Question(id="overall", text="Votre parcours dans son ensemble"),
        ],
        choices=[
            Choice(value=0, label="Pas du tout satisfait(e)"),
            Choice(value=1, label="Peu satisfait(e)"),
            Choice(value=2, label="Moyennement satisfait(e)"),
            Choice(value=3, label="Satisfait(e)"),
            Choice(value=4, label="Très satisfait(e)"),
        ],
    ),
}


def list_due(db: Session, user: CurrentUser) -> list[Questionnaire]:
    """What the patient should answer now, ready to display."""
    patient_id = _own_patient_id(db, user)
    due = [
        questionnaire
        for instrument, questionnaire in QUESTIONNAIRES.items()
        if _due_period(db, patient_id, instrument) is not None
    ]
    audit.record(db, user.id, "questionnaire.due.read", patient_id)
    db.commit()
    return due


def submit_response(
    db: Session, user: CurrentUser, instrument: Instrument, data: ResponseCreate
) -> SubmittedOut:
    patient_id = _own_patient_id(db, user)
    period = _due_period(db, patient_id, instrument)
    if period is None:
        raise ConflictError("This questionnaire isn't due")
    _check_answers(QUESTIONNAIRES[instrument], data.answers)

    response = QuestionnaireResponse(
        patient_id=patient_id,
        instrument=instrument,
        period=period,
        answers=data.answers,
        score=round(mean(data.answers.values()) / 4 * 100, 1),
        submitted_at=datetime.now(UTC),
    )
    db.add(response)
    audit.record(db, user.id, f"questionnaire.{instrument.value}", patient_id)
    db.commit()
    return SubmittedOut.model_validate(response, from_attributes=True)


def list_my_scores(db: Session, user: CurrentUser) -> list[ScoreOut]:
    patient_id = _own_patient_id(db, user)
    scores = _quality_of_life_scores(db, patient_id)
    audit.record(db, user.id, "questionnaire.read", patient_id)
    db.commit()
    return scores


def list_patient_scores(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> list[ScoreOut]:
    """Quality-of-life results over time, for the patient's care team."""
    if user.role not in CARE_ROLES or not care_team.is_in_care_team(db, user.id, patient_id):
        _deny(db, user, patient_id)
    scores = _quality_of_life_scores(db, patient_id)
    audit.record(db, user.id, "questionnaire.read", patient_id)
    db.commit()
    return scores


def list_sessions_to_rate(db: Session, user: CurrentUser) -> list[SessionOut]:
    """The patient's finished sessions of the last two weeks that they haven't rated yet."""
    patient_id = _own_patient_id(db, user)
    since = datetime.now(UTC) - RATING_WINDOW
    sessions = _sessions_out(db, scheduling.list_done_sessions(db, patient_id, since))
    audit.record(db, user.id, "session_evaluation.due.read", patient_id)
    db.commit()
    return [s for s in sessions if s.patient_satisfaction is None]


def rate_session_as_patient(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, data: PatientRating
) -> SessionOut:
    patient_id = _own_patient_id(db, user)
    appointment = _finished_session(db, appointment_id)
    if appointment.patient_id != patient_id:
        audit.record(db, user.id, "session_evaluation.rate.denied", appointment.patient_id)
        db.commit()
        raise ForbiddenError("This is not your session")
    if appointment.starts_at < datetime.now(UTC) - RATING_WINDOW:
        raise ConflictError("This session is too old to rate")
    evaluation = _evaluation_for(db, appointment)
    if evaluation.patient_rated_at is not None:
        raise ConflictError("You have already rated this session")
    evaluation.patient_difficulty = data.difficulty
    evaluation.patient_satisfaction = data.satisfaction
    evaluation.patient_rated_at = datetime.now(UTC)
    audit.record(db, user.id, "session_evaluation.patient", patient_id)
    db.commit()
    return _sessions_out(db, [appointment])[0]


def rate_session_as_practitioner(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, data: PractitionerRating
) -> SessionOut:
    """Only the practitioner who led the session; they may correct their rating later."""
    appointment = _finished_session(db, appointment_id)
    if user.role not in CARE_ROLES or appointment.professional_id != user.id:
        audit.record(db, user.id, "session_evaluation.rate.denied", appointment.patient_id)
        db.commit()
        raise ForbiddenError("Only the practitioner who led this session can rate it")
    evaluation = _evaluation_for(db, appointment)
    evaluation.coping = data.coping
    evaluation.intensity_mets = data.intensity_mets
    evaluation.practitioner_rated_at = datetime.now(UTC)
    audit.record(db, user.id, "session_evaluation.practitioner", appointment.patient_id)
    db.commit()
    return _sessions_out(db, [appointment])[0]


def list_patient_sessions(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> list[SessionOut]:
    """Every finished session of the patient and its evaluation, newest first."""
    if user.role not in CARE_ROLES or not care_team.is_in_care_team(db, user.id, patient_id):
        _deny(db, user, patient_id)
    sessions = _sessions_out(db, scheduling.list_done_sessions(db, patient_id))
    audit.record(db, user.id, "session_evaluation.read", patient_id)
    db.commit()
    return sessions


def session_satisfaction(db: Session) -> tuple[int, list[int]]:
    """For analytics: how many patients rated sessions, and every satisfaction rating, with
    nothing that identifies anyone."""
    rated = SessionEvaluation.patient_satisfaction.is_not(None)
    patient_count = db.scalar(
        select(func.count(func.distinct(SessionEvaluation.patient_id))).where(rated)
    )
    values = db.scalars(select(SessionEvaluation.patient_satisfaction).where(rated))
    return patient_count or 0, [value for value in values if value is not None]


def monthly_quality_of_life(db: Session, since: str) -> list[tuple[str, int, float]]:
    """For analytics: per month from `since` ("2026-01"), respondents and average score."""
    query = (
        select(
            QuestionnaireResponse.period,
            func.count(func.distinct(QuestionnaireResponse.patient_id)),
            func.avg(QuestionnaireResponse.score),
        )
        .where(
            QuestionnaireResponse.instrument == Instrument.QUALITY_OF_LIFE,
            QuestionnaireResponse.period >= since,
        )
        .group_by(QuestionnaireResponse.period)
        .order_by(QuestionnaireResponse.period)
    )
    return [(period, count, float(average)) for period, count, average in db.execute(query)]


def satisfaction_answers(db: Session) -> list[dict[str, int]]:
    """For analytics: every satisfaction answer set, with nothing that identifies the patient."""
    query = select(QuestionnaireResponse.answers).where(
        QuestionnaireResponse.instrument == Instrument.SATISFACTION
    )
    return list(db.scalars(query))


def _due_period(db: Session, patient_id: uuid.UUID, instrument: Instrument) -> str | None:
    """The period this questionnaire is due for, or None if nothing is due."""
    if instrument == Instrument.QUALITY_OF_LIFE:
        if pathways.get_open_pathway_id(db, patient_id) is None:
            return None
        period = datetime.now(ZoneInfo(get_settings().institute_time_zone)).strftime("%Y-%m")
    else:
        closed = pathways.get_last_closed_pathway_id(db, patient_id)
        if closed is None:
            return None
        period = str(closed)
    answered = select(QuestionnaireResponse.id).where(
        QuestionnaireResponse.patient_id == patient_id,
        QuestionnaireResponse.instrument == instrument,
        QuestionnaireResponse.period == period,
    )
    return None if db.scalar(answered) is not None else period


def _check_answers(questionnaire: Questionnaire, answers: dict[str, int]) -> None:
    question_ids = {q.id for q in questionnaire.questions}
    values = {c.value for c in questionnaire.choices}
    if set(answers) != question_ids or not set(answers.values()) <= values:
        raise AppError("Answer every question with one of the proposed choices")


def _quality_of_life_scores(db: Session, patient_id: uuid.UUID) -> list[ScoreOut]:
    query = (
        select(QuestionnaireResponse)
        .where(
            QuestionnaireResponse.patient_id == patient_id,
            QuestionnaireResponse.instrument == Instrument.QUALITY_OF_LIFE,
        )
        .order_by(QuestionnaireResponse.period)
    )
    scores: list[ScoreOut] = []
    for response in db.scalars(query):
        previous = scores[-1].score if scores else None
        scores.append(
            ScoreOut(
                period=response.period,
                score=response.score,
                change=round(response.score - previous, 1) if previous is not None else None,
                submitted_at=response.submitted_at,
            )
        )
    return scores


def _finished_session(db: Session, appointment_id: uuid.UUID) -> AppointmentOut:
    appointment = scheduling.get_appointment(db, appointment_id)
    if appointment.status != AppointmentStatus.DONE:
        raise ConflictError("Only a finished session can be rated")
    return appointment


def _evaluation_for(db: Session, appointment: AppointmentOut) -> SessionEvaluation:
    """The session's evaluation row, created on first rating. Locked until commit."""
    query = select(SessionEvaluation).where(SessionEvaluation.appointment_id == appointment.id)
    evaluation = db.scalar(query.with_for_update())
    if evaluation is None:
        evaluation = SessionEvaluation(
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            professional_id=appointment.professional_id,
        )
        db.add(evaluation)
    return evaluation


def _sessions_out(db: Session, appointments: list[AppointmentOut]) -> list[SessionOut]:
    ids = [a.id for a in appointments]
    query = select(SessionEvaluation).where(SessionEvaluation.appointment_id.in_(ids))
    by_appointment = {e.appointment_id: e for e in db.scalars(query)} if ids else {}
    sessions = []
    for a in appointments:
        evaluation = by_appointment.get(a.id) or SessionEvaluation()
        sessions.append(
            SessionOut(
                appointment_id=a.id,
                starts_at=a.starts_at,
                professional_id=a.professional_id,
                professional_name=a.professional_name,
                patient_difficulty=evaluation.patient_difficulty,
                patient_satisfaction=evaluation.patient_satisfaction,
                coping=evaluation.coping,
                intensity_mets=evaluation.intensity_mets,
            )
        )
    return sessions


def _own_patient_id(db: Session, user: CurrentUser) -> uuid.UUID:
    if user.role != Role.PATIENT:
        raise ForbiddenError("Only patients answer questionnaires")
    patient_id = patients.get_patient_id_for_user(db, user.id)
    if patient_id is None:
        raise NotFoundError("No patient record is linked to this account")
    return patient_id


def _deny(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> NoReturn:
    audit.record(db, user.id, "questionnaire.read.denied", patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to see this patient's results")
