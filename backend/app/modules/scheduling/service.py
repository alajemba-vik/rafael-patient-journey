"""Appointments and their status. Public API of the scheduling module.

Access policy:
- coordinator, secretary → book and cancel appointments
- patient                → their own appointments
- professional,
  coordinator            → their own schedule, and the appointments of patients in their care team
- secretary              → any patient's appointments (administrative data only)

Reception moves an appointment's status through `list_between` and `set_status`; those two
check no permissions themselves, so their callers must.
"""

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import NoReturn

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients import service as patients
from app.modules.scheduling.models import Appointment, AppointmentStatus
from app.modules.scheduling.schemas import AppointmentCreate, AppointmentOut

# TODO(validate): who enters appointments in the system: coordinators, reception or both,
# and who cancels when a patient phones? (V-03)
BOOKING_ROLES = {Role.COORDINATOR, Role.SECRETARY}
CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
UPCOMING_WINDOW = timedelta(days=90)

# Undoing a mis-click (arrived or no-show back to scheduled) is allowed; finished or
# cancelled appointments are final.
_NEXT_STATUSES = {
    AppointmentStatus.SCHEDULED: {AppointmentStatus.ARRIVED, AppointmentStatus.NO_SHOW},
    AppointmentStatus.ARRIVED: {AppointmentStatus.DONE, AppointmentStatus.SCHEDULED},
    AppointmentStatus.NO_SHOW: {AppointmentStatus.SCHEDULED},
    AppointmentStatus.DONE: set(),
    AppointmentStatus.CANCELLED: set(),
}


def create_appointment(db: Session, user: CurrentUser, data: AppointmentCreate) -> AppointmentOut:
    if user.role not in BOOKING_ROLES:
        _deny(db, user, "appointment.create.denied", data.patient_id)
    if not patients.patient_exists(db, data.patient_id):
        raise NotFoundError("Patient not found")
    if not care_team.is_in_care_team(db, data.professional_id, data.patient_id):
        raise ConflictError("This person isn't in the patient's care team")
    if _has_overlap(db, data):
        raise ConflictError("The patient or the practitioner already has an appointment then")

    appointment = Appointment(**data.model_dump(), created_by=user.id)
    db.add(appointment)
    audit.record(db, user.id, "appointment.create", data.patient_id)
    db.commit()
    return _to_out(db, [appointment])[0]


def cancel_appointment(db: Session, user: CurrentUser, appointment_id: uuid.UUID) -> AppointmentOut:
    appointment = _get(db, appointment_id)
    if user.role not in BOOKING_ROLES:
        _deny(db, user, "appointment.cancel.denied", appointment.patient_id)
    if appointment.status != AppointmentStatus.SCHEDULED:
        raise ConflictError("Only a scheduled appointment can be cancelled")

    appointment.status = AppointmentStatus.CANCELLED
    audit.record(db, user.id, "appointment.cancel", appointment.patient_id)
    db.commit()
    return _to_out(db, [appointment])[0]


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
    return _to_out(db, appointments)


def list_patient_appointments(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> list[AppointmentOut]:
    if not _can_see_patient(db, user, patient_id):
        _deny(db, user, "appointment.list.denied", patient_id)

    query = select(Appointment).where(Appointment.patient_id == patient_id)
    appointments = list(db.scalars(query.order_by(Appointment.starts_at)))
    audit.record(db, user.id, "appointment.list", patient_id)
    db.commit()
    return _to_out(db, appointments)


def list_between(db: Session, start: datetime, end: datetime) -> list[AppointmentOut]:
    """Every non-cancelled appointment in a time window. Callers check access and audit."""
    query = (
        select(Appointment)
        .where(Appointment.starts_at >= start, Appointment.starts_at < end)
        .where(Appointment.status != AppointmentStatus.CANCELLED)
        .order_by(Appointment.starts_at)
    )
    return _to_out(db, list(db.scalars(query)))


def set_status(db: Session, appointment_id: uuid.UUID, status: AppointmentStatus) -> AppointmentOut:
    """Move an appointment along its lifecycle. Callers check access, audit and commit."""
    appointment = _get(db, appointment_id)
    if status not in _NEXT_STATUSES[appointment.status]:
        raise ConflictError(f"An appointment can't go from {appointment.status} to {status}")
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


def _can_see_patient(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> bool:
    if user.role == Role.SECRETARY:
        return True
    if user.role == Role.PATIENT:
        return patients.get_patient_id_for_user(db, user.id) == patient_id
    if user.role in CARE_ROLES:
        return care_team.is_in_care_team(db, user.id, patient_id)
    return False


def _has_overlap(db: Session, data: AppointmentCreate) -> bool:
    query = select(Appointment.id).where(
        Appointment.status != AppointmentStatus.CANCELLED,
        Appointment.starts_at < data.ends_at,
        Appointment.ends_at > data.starts_at,
        or_(
            Appointment.professional_id == data.professional_id,
            Appointment.patient_id == data.patient_id,
        ),
    )
    return db.scalar(query.limit(1)) is not None


def _to_out(db: Session, appointments: Iterable[Appointment]) -> list[AppointmentOut]:
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
            starts_at=a.starts_at,
            ends_at=a.ends_at,
            status=a.status,
        )
        for a in appointments
    ]


def _get(db: Session, appointment_id: uuid.UUID) -> Appointment:
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found")
    return appointment


def _deny(db: Session, user: CurrentUser, action: str, patient_id: uuid.UUID) -> NoReturn:
    audit.record(db, user.id, action, patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to do this for this patient")
