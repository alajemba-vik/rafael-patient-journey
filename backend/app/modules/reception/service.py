"""Reception board: today's appointments and arrivals. Secretaries only, administrative data only.

Reads and changes appointments through scheduling.service; the status lifecycle lives there.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta
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
    appointments = scheduling.list_between(
        db, *day_window(datetime.now(time_zone).date(), time_zone)
    )
    audit.record_many(db, user.id, "reception.read", {a.patient_id for a in appointments})
    db.commit()
    return appointments


def day_window(day: date, time_zone: ZoneInfo) -> tuple[datetime, datetime]:
    """Local midnight to the next local midnight, in UTC: 23 or 25 hours on clock-change days."""
    start = datetime.combine(day, time.min, tzinfo=time_zone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=time_zone)
    return start.astimezone(UTC), end.astimezone(UTC)


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
