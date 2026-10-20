"""Reception board: today's appointments and arrivals. Secretaries only, administrative data only.

Reads and changes appointments through scheduling.service; the status lifecycle lives there.
"""

import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app import audit
from app.config import get_settings
from app.errors import ForbiddenError
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.scheduling import service as scheduling
from app.modules.scheduling.service import AppointmentOut, AppointmentStatus

# TODO(validate): what does reception do on arrival, and are no-shows recorded? (V-04, V-05)
RECEPTION_ROLES = {Role.SECRETARY}


def list_today(db: Session, user: CurrentUser) -> list[AppointmentOut]:
    """Today's appointments at the Institute, in order, cancelled ones left out."""
    _require_reception(db, user)
    # TODO(validate): does Hartmann share this platform, and in which time zone? (V-02)
    time_zone = ZoneInfo(get_settings().institute_time_zone)
    today = datetime.now(time_zone).date()
    start = datetime.combine(today, time.min, tzinfo=time_zone).astimezone(UTC)
    appointments = scheduling.list_between(db, start, start + timedelta(days=1))
    audit.record_many(db, user.id, "reception.read", {a.patient_id for a in appointments})
    db.commit()
    return appointments


def change_status(
    db: Session, user: CurrentUser, appointment_id: uuid.UUID, status: AppointmentStatus
) -> AppointmentOut:
    _require_reception(db, user)
    appointment = scheduling.set_status(db, appointment_id, status)
    audit.record(db, user.id, f"appointment.{status.value}", appointment.patient_id)
    db.commit()
    return appointment


def _require_reception(db: Session, user: CurrentUser) -> None:
    if user.role not in RECEPTION_ROLES:
        audit.record(db, user.id, "reception.denied", None)
        db.commit()
        raise ForbiddenError("Only reception can use the reception board")
