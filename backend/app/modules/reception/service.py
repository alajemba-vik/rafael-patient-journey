"""Reception board: a day's appointments, arrivals and the waiting room. Secretaries only,
administrative data only.

Reads and changes appointments through scheduling.service; the status lifecycle lives there.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app import audit
from app.errors import ForbiddenError
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients import service as patients
from app.modules.reception.schemas import CallBack
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.service import AppointmentOut, AppointmentStatus, day_window

RECEPTION_ROLES = {Role.SECRETARY}
# Absences older than this no longer call for a phone call.
CALL_BACK_WINDOW = timedelta(days=30)


def list_today(db: Session, user: CurrentUser) -> list[AppointmentOut]:
    """Today's appointments at the Institute, in order, cancelled ones left out."""
    _require_reception(db, user)
    appointments = scheduling.list_between(
        db, *day_window(_today(), scheduling.institute_time_zone())
    )
    audit.record_many(db, user.id, "reception.read", {a.patient_id for a in appointments})
    db.commit()
    return appointments


def list_day(db: Session, user: CurrentUser, day: date | None) -> list[AppointmentOut]:
    """One day's appointments, cancelled ones included, so reception can tell a patient who
    turns up that their session was called off. Defaults to today."""
    _require_reception(db, user)
    window = day_window(day or _today(), scheduling.institute_time_zone())
    appointments = scheduling.list_between(db, *window, include_cancelled=True)
    audit.record_many(db, user.id, "reception.read", {a.patient_id for a in appointments})
    db.commit()
    return appointments


def change_status(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, status: AppointmentStatus
) -> AppointmentOut:
    """Check-in, call-in, end of session or no-show, and their undos.

    Which changes a day allows (today, a past day, a later one) is scheduling's rule.
    """
    _require_reception(db, user)
    appointment = scheduling.set_status(db, appointment_id, status)
    audit.record(db, user.id, f"appointment.{status.value}", appointment.patient_id)
    db.commit()
    return appointment


def list_call_backs(db: Session, user: CurrentUser) -> list[CallBack]:
    """Patients who missed an appointment in the last 30 days, those with nothing booked
    first, then those who missed most. Unreachable patients are how people get lost."""
    _require_reception(db, user)
    missed = scheduling.list_missed_since(db, datetime.now(UTC) - CALL_BACK_WINDOW)
    by_patient: dict[uuid.UUID, list[AppointmentOut]] = {}
    for appointment in missed:
        by_patient.setdefault(appointment.patient_id, []).append(appointment)
    ids = set(by_patient)
    phones = patients.get_phones(db, ids)
    upcoming = scheduling.next_appointments(db, ids)
    call_backs = [
        CallBack(
            patient_id=patient_id,
            patient_name=appointments[0].patient_name,
            phone=phones.get(patient_id),
            missed=len(appointments),
            last_missed_at=appointments[0].starts_at,
            next_appointment_at=upcoming.get(patient_id),
        )
        for patient_id, appointments in by_patient.items()
    ]
    call_backs.sort(key=lambda c: (c.next_appointment_at is not None, -c.missed))
    audit.record_many(db, user.id, "reception.call_backs.read", ids)
    db.commit()
    return call_backs


def _today() -> date:
    return datetime.now(scheduling.institute_time_zone()).date()


def _require_reception(db: Session, user: CurrentUser) -> None:
    if user.role not in RECEPTION_ROLES:
        audit.record(db, user.id, "reception.denied", None)
        db.commit()
        raise ForbiddenError("Only reception can use the reception board")
