"""Reception board: a day's appointments, arrivals and the waiting room. Secretaries only,
administrative data only.

Reads and changes appointments through scheduling.service; the status lifecycle lives there.
"""

import uuid
from datetime import date, datetime

from sqlalchemy.orm import Session

from app import audit
from app.errors import ForbiddenError
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.service import AppointmentOut, AppointmentStatus, day_window

# TODO(validate): what does reception do on arrival, and are no-shows recorded? (V-04, V-05)
RECEPTION_ROLES = {Role.SECRETARY}


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


def _today() -> date:
    return datetime.now(scheduling.institute_time_zone()).date()


def _require_reception(db: Session, user: CurrentUser) -> None:
    if user.role not in RECEPTION_ROLES:
        audit.record(db, user.id, "reception.denied", None)
        db.commit()
        raise ForbiddenError("Only reception can use the reception board")
