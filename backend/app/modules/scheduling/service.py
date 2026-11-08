"""Appointments and their status. Public API of the scheduling module.

Access policy:
- coordinator, secretary → book, move, cancel and annotate appointments; see a practitioner's
                           availability (busy and free times, no patient names)
- patient                → their own appointments (without staff notes)
- professional,
  coordinator            → their own schedule, and the appointments of patients in their care team
- secretary              → any patient's appointments (administrative data only)

Reception moves an appointment's status through `list_between` and `set_status`; those two
check no permissions themselves, so their callers must.
"""

import uuid
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from typing import NoReturn
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit
from app.config import get_settings
from app.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients import service as patients
from app.modules.scheduling.models import Appointment, AppointmentStatus
from app.modules.scheduling.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    AppointmentUpdate,
    Availability,
    TimeSlot,
)

# Who books (working assumption A-01 in the team knowledge base, open-questions.md):
# - coordinators book the first session with each practitioner, reception books for patients
#   who phone or ask at the desk: both for anyone in the patient's care team;
# - patients book their follow-ups directly with their practitioner, so a practitioner
#   books, moves, cancels and annotates their **own** sessions with their own patients.
# TODO(validate): confirm with the Institute (V-03, V-24).
BOOKING_ROLES = {Role.COORDINATOR, Role.SECRETARY}
OWN_AGENDA_ROLES = {Role.PROFESSIONAL}
CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
UPCOMING_WINDOW = timedelta(days=90)

# Opening hours (working assumption A-02): sessions on weekdays, 9:00 to 19:00, the same for
# every practitioner. The Institute's site publishes no hours; a directory listing gives
# weekdays 9:00-13:00, probably the reception desk or phone line rather than sessions.
# Only free-slot suggestions follow these hours: staff can still book any time by hand.
# TODO(validate): real hours, Saturday activities, per-practitioner days (V-27).
OPENING_TIME = time(9, 0)
CLOSING_TIME = time(19, 0)
OPEN_WEEKDAYS = frozenset(range(5))  # Monday (0) to Friday (4)
# The days anyone may look at: agendas don't go back before the platform or far ahead.
FIRST_DAY = date(2000, 1, 1)
LAST_DAY = date(2100, 12, 31)
# Free slots start on the quarter hour: easy to say on the phone, easy to read on a card.
SLOT_STEP = timedelta(minutes=15)

# Today: undoing a mis-click (back one step) is allowed; finished or cancelled ones are final.
_NEXT_STATUSES = {
    AppointmentStatus.SCHEDULED: {AppointmentStatus.ARRIVED, AppointmentStatus.NO_SHOW},
    AppointmentStatus.ARRIVED: {
        AppointmentStatus.IN_SESSION,
        AppointmentStatus.DONE,
        AppointmentStatus.SCHEDULED,
    },
    AppointmentStatus.IN_SESSION: {AppointmentStatus.DONE, AppointmentStatus.ARRIVED},
    AppointmentStatus.NO_SHOW: {AppointmentStatus.SCHEDULED},
    AppointmentStatus.DONE: set(),
    AppointmentStatus.CANCELLED: set(),
}
# A past day: only outcomes can be recorded, and a no-show undone.
_PAST_DAY_STATUSES = {
    AppointmentStatus.SCHEDULED: {AppointmentStatus.DONE, AppointmentStatus.NO_SHOW},
    AppointmentStatus.ARRIVED: {AppointmentStatus.DONE, AppointmentStatus.NO_SHOW},
    AppointmentStatus.IN_SESSION: {AppointmentStatus.DONE},
    AppointmentStatus.NO_SHOW: {AppointmentStatus.SCHEDULED},
    AppointmentStatus.DONE: set(),
    AppointmentStatus.CANCELLED: set(),
}


class SlotTakenError(ConflictError):
    def __init__(self) -> None:
        super().__init__("The patient or the practitioner already has an appointment then")


def create_appointment(db: Session, user: CurrentUser, data: AppointmentCreate) -> AppointmentOut:
    own_session = user.role in OWN_AGENDA_ROLES and data.professional_id == user.id
    if user.role not in BOOKING_ROLES and not own_session:
        _deny(db, user, "appointment.create.denied", data.patient_id)
    if not patients.patient_exists(db, data.patient_id):
        raise NotFoundError("Patient not found")
    if not care_team.is_in_care_team(db, data.professional_id, data.patient_id):
        if own_session:  # a practitioner only books for their own patients
            _deny(db, user, "appointment.create.denied", data.patient_id)
        raise ConflictError("This person isn't in the patient's care team")
    _check_not_before_today(data.starts_at)
    if _has_overlap(db, data.patient_id, data.professional_id, data.starts_at, data.ends_at):
        raise SlotTakenError()

    appointment = Appointment(
        **data.model_dump(exclude={"note"}), note=data.note or None, created_by=user.id
    )
    db.add(appointment)
    audit.record(db, user.id, "appointment.create", data.patient_id)
    _commit_unless_slot_taken(db)
    return _to_out(db, [appointment])[0]


def reschedule_appointment(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, data: AppointmentReschedule
) -> AppointmentOut:
    """Same patient and practitioner, new time. Only appointments still to come can move."""
    _require_manage(db, user, "appointment.reschedule.denied", appointment_id)
    appointment = _get(db, appointment_id, for_update=True)
    if appointment.status != AppointmentStatus.SCHEDULED:
        raise ConflictError("Only a scheduled appointment can be moved")
    _check_not_on_past_day(appointment)
    _check_not_before_today(data.starts_at)
    if _has_overlap(
        db,
        appointment.patient_id,
        appointment.professional_id,
        data.starts_at,
        data.ends_at,
        ignore_id=appointment.id,
    ):
        raise SlotTakenError()

    appointment.starts_at, appointment.ends_at = data.starts_at, data.ends_at
    audit.record(db, user.id, "appointment.reschedule", appointment.patient_id)
    _commit_unless_slot_taken(db)
    return _to_out(db, [appointment])[0]


def cancel_appointment(
    db: Session,
    user: CurrentUser,
    appointment_id: uuid.UUID,
    data: AppointmentCancel | None = None,
) -> AppointmentOut:
    """Called off ahead of time. A past day's appointment that didn't happen is a no-show."""
    _require_manage(db, user, "appointment.cancel.denied", appointment_id)
    appointment = _get(db, appointment_id, for_update=True)
    if appointment.status != AppointmentStatus.SCHEDULED:
        raise ConflictError("Only a scheduled appointment can be cancelled")
    _check_not_on_past_day(appointment)

    appointment.status = AppointmentStatus.CANCELLED
    appointment.cancelled_at = datetime.now(UTC)
    appointment.cancel_reason = (data or AppointmentCancel()).reason
    audit.record(db, user.id, "appointment.cancel", appointment.patient_id)
    db.commit()
    return _to_out(db, [appointment])[0]


def update_appointment(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, data: AppointmentUpdate
) -> AppointmentOut:
    """Staff write down what used to go on a sticky note: "running 10 minutes late"."""
    _require_manage(db, user, "appointment.note.denied", appointment_id)
    appointment = _get(db, appointment_id, for_update=True)

    appointment.note = data.note or None
    audit.record(db, user.id, "appointment.note", appointment.patient_id)
    db.commit()
    return _to_out(db, [appointment])[0]


def get_availability(
    db: Session,
    user: CurrentUser,
    professional_id: uuid.UUID,
    day: date,
    minutes: int,
    patient_id: uuid.UUID | None = None,
    ignore_id: uuid.UUID | None = None,
) -> Availability:
    """Times taken and free on one day, to book without phoning around.

    Taken means by the practitioner, or by the patient (`patient_id`) with anyone else, so a
    free slot can really be booked. `ignore_id` leaves out the appointment being moved.
    No patient names are returned.
    """
    own_agenda = user.role in OWN_AGENDA_ROLES and professional_id == user.id
    if user.role not in BOOKING_ROLES and not own_agenda:
        raise ForbiddenError("You can only see your own availability")
    if identity.get_role(db, professional_id) not in CARE_ROLES:
        raise NotFoundError("No professional or coordinator account with this id")
    if own_agenda and patient_id and not care_team.is_in_care_team(db, user.id, patient_id):
        _deny(db, user, "appointment.availability.denied", patient_id)

    start, end = day_window(day, institute_time_zone())
    people = [Appointment.professional_id == professional_id]
    if patient_id is not None:
        people.append(Appointment.patient_id == patient_id)
    query = (
        select(Appointment.starts_at, Appointment.ends_at)
        .where(or_(*people))
        .where(Appointment.status != AppointmentStatus.CANCELLED)
        .where(Appointment.starts_at < end, Appointment.ends_at > start)
        .order_by(Appointment.starts_at)
    )
    if ignore_id is not None:
        query = query.where(Appointment.id != ignore_id)
    busy = [TimeSlot(starts_at=_aware(s), ends_at=_aware(e)) for s, e in db.execute(query)]
    if patient_id is not None:
        audit.record(db, user.id, "appointment.availability", patient_id)
        db.commit()
    return Availability(
        day=day, minutes=minutes, busy=busy, free=_free_slots(day, timedelta(minutes=minutes), busy)
    )


def list_my_appointments(
    db: Session, user: CurrentUser, start: datetime | None, end: datetime | None
) -> list[AppointmentOut]:
    """A patient's own appointments, or a practitioner's or coordinator's own schedule."""
    start = start or datetime.now(UTC)
    end = end or start + UPCOMING_WINDOW
    query = select(Appointment).where(Appointment.starts_at >= start, Appointment.starts_at < end)

    if user.role == Role.PATIENT:
        patient_id = patients.get_patient_id_for_user(db, user.id)
        if patient_id is None:
            return []
        query = query.where(Appointment.patient_id == patient_id)
    elif user.role in CARE_ROLES:
        query = query.where(Appointment.professional_id == user.id)
    else:
        raise ForbiddenError("Use the reception or patient views instead")

    appointments = list(db.scalars(query.order_by(Appointment.starts_at)))
    audit.record_many(db, user.id, "appointment.list", {a.patient_id for a in appointments})
    db.commit()
    return _to_out(db, appointments, with_notes=user.role != Role.PATIENT)


def list_patient_appointments(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> list[AppointmentOut]:
    if not _can_see_patient(db, user, patient_id):
        _deny(db, user, "appointment.list.denied", patient_id)

    query = select(Appointment).where(Appointment.patient_id == patient_id)
    appointments = list(db.scalars(query.order_by(Appointment.starts_at)))
    audit.record(db, user.id, "appointment.list", patient_id)
    db.commit()
    return _to_out(db, appointments, with_notes=user.role != Role.PATIENT)


def list_between(
    db: Session, start: datetime, end: datetime, include_cancelled: bool = False
) -> list[AppointmentOut]:
    """Every appointment in a time window, in order. Callers check access and audit."""
    query = select(Appointment).where(Appointment.starts_at >= start, Appointment.starts_at < end)
    if not include_cancelled:
        query = query.where(Appointment.status != AppointmentStatus.CANCELLED)
    return _to_out(db, list(db.scalars(query.order_by(Appointment.starts_at))))


def set_status(db: Session, appointment_id: uuid.UUID, status: AppointmentStatus) -> AppointmentOut:
    """Move an appointment along its lifecycle and stamp the waiting-room times.

    Which moves are possible depends on the day:
    - today: the waiting room, step by step, and a no-show once the session should have begun;
    - a past day: only closing what was left open (done or no-show, and undoing a no-show),
      with no arrival or call-in times, since nobody knows them;
    - a later day: nothing, an arrival tomorrow is a mis-click.

    Callers check access, audit and commit. The row is locked until then, so two people
    clicking the same card at once can't both apply a change.
    """
    appointment = _get(db, appointment_id, for_update=True)
    now = datetime.now(UTC)
    _check_status_change(appointment, status, now)
    if status == AppointmentStatus.ARRIVED:
        # Arriving, or sent back to the waiting room by mistake: keep the first arrival time.
        appointment.arrived_at = appointment.arrived_at or now
        appointment.called_in_at = None
    elif status == AppointmentStatus.IN_SESSION:
        appointment.called_in_at = now
    elif status in {AppointmentStatus.SCHEDULED, AppointmentStatus.NO_SHOW}:
        appointment.arrived_at = None
        appointment.called_in_at = None
    appointment.status = status
    return _to_out(db, [appointment])[0]


def count_by_status(db: Session, start: datetime, end: datetime) -> dict[AppointmentStatus, int]:
    """For analytics: how many appointments in a window are in each status. Totals only."""
    query = (
        select(Appointment.status, func.count())
        .where(Appointment.starts_at >= start, Appointment.starts_at < end)
        .group_by(Appointment.status)
    )
    return {status: count for status, count in db.execute(query)}


def institute_time_zone() -> ZoneInfo:
    # TODO(validate): does Hartmann share this platform, and in which time zone? (V-02)
    return ZoneInfo(get_settings().institute_time_zone)


def day_window(day: date, time_zone: ZoneInfo) -> tuple[datetime, datetime]:
    """Local midnight to the next local midnight, in UTC: 23 or 25 hours on clock-change days.

    Days outside FIRST_DAY..LAST_DAY are refused: a half-typed year in a date field shouldn't
    reach the database (or overflow the date arithmetic).
    """
    if not FIRST_DAY <= day <= LAST_DAY:
        raise AppError(f"Choose a day between {FIRST_DAY.year} and {LAST_DAY.year}")
    start = datetime.combine(day, time.min, tzinfo=time_zone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=time_zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def _free_slots(day: date, length: timedelta, busy: list[TimeSlot]) -> list[TimeSlot]:
    """Every quarter-hour start between opening and closing where a session fits; none on a
    day the Institute is closed."""
    if day.weekday() not in OPEN_WEEKDAYS:
        return []
    time_zone = institute_time_zone()
    candidate = datetime.combine(day, OPENING_TIME, tzinfo=time_zone).astimezone(UTC)
    closing = datetime.combine(day, CLOSING_TIME, tzinfo=time_zone).astimezone(UTC)
    now = datetime.now(UTC)
    free = []
    while candidate + length <= closing:
        end = candidate + length
        clashes = any(slot.starts_at < end and slot.ends_at > candidate for slot in busy)
        if candidate >= now and not clashes:
            free.append(TimeSlot(starts_at=candidate, ends_at=end))
        candidate += SLOT_STEP
    return free


def _check_status_change(
    appointment: Appointment, status: AppointmentStatus, now: datetime
) -> None:
    starts = _aware(appointment.starts_at)
    time_zone = institute_time_zone()
    day, today = starts.astimezone(time_zone).date(), now.astimezone(time_zone).date()
    if day > today:
        raise ConflictError("Nothing can be recorded for a day that hasn't come yet")
    allowed = (_PAST_DAY_STATUSES if day < today else _NEXT_STATUSES)[appointment.status]
    if status not in allowed:
        raise ConflictError(f"An appointment can't go from {appointment.status} to {status}")
    if status == AppointmentStatus.NO_SHOW and starts > now:
        raise ConflictError("A patient can't be marked absent before the session starts")


def _check_not_on_past_day(appointment: Appointment) -> None:
    time_zone = institute_time_zone()
    day = _aware(appointment.starts_at).astimezone(time_zone).date()
    if day < datetime.now(time_zone).date():
        raise ConflictError("This appointment's day has passed: record it as done or absent")


def _check_not_before_today(starts_at: datetime) -> None:
    """New or moved appointments can't land on a past day. Earlier today is fine: walk-ins."""
    time_zone = institute_time_zone()
    if starts_at.astimezone(time_zone).date() < datetime.now(time_zone).date():
        raise AppError("An appointment can't be booked on a past day")


def _commit_unless_slot_taken(db: Session) -> None:
    """On Postgres the database itself refuses overlapping appointments, so two people booking
    the same slot at the same instant can't both succeed. Report that as a taken slot."""
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if "no_overlap" in str(error.orig):
            raise SlotTakenError() from error
        raise


def _can_see_patient(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> bool:
    if user.role == Role.SECRETARY:
        return True
    if user.role == Role.PATIENT:
        return patients.get_patient_id_for_user(db, user.id) == patient_id
    if user.role in CARE_ROLES:
        return care_team.is_in_care_team(db, user.id, patient_id)
    return False


def _has_overlap(
    db: Session,
    patient_id: uuid.UUID,
    professional_id: uuid.UUID,
    starts_at: datetime,
    ends_at: datetime,
    ignore_id: uuid.UUID | None = None,
) -> bool:
    query = select(Appointment.id).where(
        Appointment.status != AppointmentStatus.CANCELLED,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
        or_(
            Appointment.professional_id == professional_id,
            Appointment.patient_id == patient_id,
        ),
    )
    if ignore_id is not None:
        query = query.where(Appointment.id != ignore_id)
    return db.scalar(query.limit(1)) is not None


def _aware(value: datetime) -> datetime:
    """SQLite (tests, local runs) returns naive datetimes; they are stored in UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _to_out(
    db: Session, appointments: Iterable[Appointment], with_notes: bool = True
) -> list[AppointmentOut]:
    """Add names with two queries in total, whatever the number of appointments."""
    appointments = list(appointments)
    patient_names = patients.get_names(db, {a.patient_id for a in appointments})
    staff_ids = list({a.professional_id for a in appointments})
    staff_names = (
        {u.id: u.full_name for u in identity.get_users(db, staff_ids)} if staff_ids else {}
    )
    return [
        AppointmentOut(
            id=a.id,
            patient_id=a.patient_id,
            patient_name=patient_names.get(a.patient_id, ""),
            professional_id=a.professional_id,
            professional_name=staff_names.get(a.professional_id, ""),
            starts_at=_aware(a.starts_at),
            ends_at=_aware(a.ends_at),
            status=a.status,
            arrived_at=a.arrived_at and _aware(a.arrived_at),
            called_in_at=a.called_in_at and _aware(a.called_in_at),
            cancel_reason=a.cancel_reason,
            note=a.note if with_notes else None,
        )
        for a in appointments
    ]


def _get(db: Session, appointment_id: uuid.UUID, for_update: bool = False) -> Appointment:
    """`for_update` locks the row until commit (Postgres), and reloads it, for writes that
    check the current status first: the second of two simultaneous clicks waits, then sees
    the first one's result."""
    query = select(Appointment).where(Appointment.id == appointment_id)
    if for_update:
        query = query.with_for_update().execution_options(populate_existing=True)
    appointment = db.scalar(query)
    if appointment is None:
        raise NotFoundError("Appointment not found")
    return appointment


def _require_manage(db: Session, user: CurrentUser, action: str, appointment_id: uuid.UUID) -> None:
    """Coordinators and reception manage any appointment; a practitioner only their own.

    Checked before anything else, so whether the appointment exists isn't revealed to
    anyone else. The refusal is audited against the patient when there is one.
    """
    if user.role in BOOKING_ROLES:
        return
    row = db.execute(
        select(Appointment.patient_id, Appointment.professional_id).where(
            Appointment.id == appointment_id
        )
    ).first()
    if row is not None and user.role in OWN_AGENDA_ROLES and row.professional_id == user.id:
        return
    _deny(db, user, action, row.patient_id if row else None)


def _deny(db: Session, user: CurrentUser, action: str, patient_id: uuid.UUID | None) -> NoReturn:
    audit.record(db, user.id, action, patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to do this for this patient")
