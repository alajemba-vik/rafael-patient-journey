"""Load a synthetic demo day: patients, practitioners, care teams and appointments.

Every person and number here is invented. Run from backend/:

    uv run python -m scripts.seed_demo            # replace the demo data with a fresh set
    uv run python -m scripts.seed_demo --remove   # remove the demo data only
    uv run python -m scripts.seed_demo --attach me@example.org

It asks before writing; `--yes` skips the question.

What it creates, around today in the Institute's time zone:
- 6 practitioners and 2 coordinators that can't log in (no identity-provider account), so
  their names appear in lists and agendas;
- 16 patients, each with a coordinator and two or three practitioners in their care team;
- yesterday's appointments (done or missed), today's at every stage of the waiting room,
  and the next five working days.

`--attach EMAIL` adds an existing practitioner or coordinator login to the demo care teams
and gives them sessions today, so a real account sees the demo when it logs in. Reception
and admin accounts see every patient already and need nothing.

Demo rows are recognised by their `@demo.rafael.invalid` email addresses and by belonging to
demo patients or staff, so `--remove` never touches anything else. This is an operations
script: unlike module code, it writes several modules' tables directly.
"""

import argparse
import random
import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.audit import AuditEvent
from app.config import get_settings
from app.db import Base, SessionLocal, load_all_models
from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import Role, User
from app.modules.patients.models import Patient
from app.modules.scheduling.models import Appointment, AppointmentStatus, CancelReason
from app.modules.scheduling.service import institute_time_zone

DEMO_DOMAIN = "demo.rafael.invalid"
DEMO_SUBJECT_PREFIX = "demo-seed:"
AUDIT_TABLE = AuditEvent.__tablename__

STAFF = [
    ("Inès Moreau", Role.COORDINATOR, "Coordination"),
    ("Paul Garnier", Role.COORDINATOR, "Coordination"),
    ("Claire Lemoine", Role.PROFESSIONAL, "Sophrologie"),
    ("Malo Bertin", Role.PROFESSIONAL, "Activité physique adaptée"),
    ("Nadia Rahmani", Role.PROFESSIONAL, "Psychologie"),
    ("Julie Faure", Role.PROFESSIONAL, "Naturopathie"),
    ("Marc Dubreuil", Role.PROFESSIONAL, "Yoga"),
    ("Léa Fontaine", Role.PROFESSIONAL, "Art-thérapie"),
]

PATIENTS = [
    ("Camille", "Aubert"), ("Thomas", "Bonnet"), ("Sophie", "Chevalier"), ("Nicolas", "Durand"),
    ("Élodie", "Fabre"), ("Julien", "Gauthier"), ("Manon", "Henry"), ("Antoine", "Joly"),
    ("Sarah", "Lambert"), ("Lucas", "Marchand"), ("Chloé", "Noël"), ("Hélène", "Perrin"),
    ("Mathieu", "Roche"), ("Nathalie", "Simon"), ("Pierre", "Vidal"), ("Amélie", "Weber"),
]  # fmt: skip

NOTES = [
    "Prévient d’un retard d’environ 10 minutes.",
    "Vient accompagnée de sa fille.",
    "Souhaite un rendez-vous en fin de matinée la prochaine fois.",
    "A rappelé pour confirmer sa venue.",
]

# Today's sessions, in minutes from the moment the seed runs, so whenever it runs the board
# shows people finished, in session, waiting, late and still to come.
TODAY_OFFSETS = [-240, -180, -120, -75, -50, -35, -20, -10, -5, 10, 25, 60, 120, 180]
SESSION = timedelta(minutes=45)
REVIEW = timedelta(minutes=60)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--remove", action="store_true", help="only remove the demo data")
    parser.add_argument("--attach", action="append", default=[], metavar="EMAIL")
    parser.add_argument("--yes", action="store_true", help="don't ask before writing")
    args = parser.parse_args()

    url = make_url(get_settings().database_url)
    target = url.database if url.drivername.startswith("sqlite") else f"{url.host}/{url.database}"
    if not args.yes and input(f"Write demo data to {target}? [y/N] ").strip().lower() != "y":
        raise SystemExit("Nothing written.")

    load_all_models()
    with SessionLocal() as db:
        removed = remove_demo_data(db)
        if args.remove:
            db.commit()
            print(f"Removed {removed} demo patients and their data from {target}.")
            return
        counts = seed(db, attach=args.attach, rng=random.Random(42))
        db.commit()
    print(f"Seeded {target}: " + ", ".join(f"{n} {what}" for what, n in counts.items()) + ".")


def remove_demo_data(db: Session) -> int:
    """Delete every demo patient and staff member, and every row about a demo patient in any
    module (appointments, pathways and their milestones, questionnaire answers…), so nothing
    is left pointing at a deleted patient. The audit log is kept: it is never rewritten."""
    patient_ids = list(db.scalars(select(Patient.id).where(_is_demo_email(Patient.email))))
    staff_ids = list(
        db.scalars(select(User.id).where(User.auth_subject.startswith(DEMO_SUBJECT_PREFIX)))
    )
    if patient_ids:
        _delete_rows_about_patients(db, patient_ids)
    if staff_ids:
        db.execute(delete(Appointment).where(Appointment.professional_id.in_(staff_ids)))
        db.execute(delete(CareAssignment).where(CareAssignment.professional_id.in_(staff_ids)))
        db.execute(delete(User).where(User.id.in_(staff_ids)))
    return len(patient_ids)


def _delete_rows_about_patients(db: Session, patient_ids: list[uuid.UUID]) -> None:
    """Children before parents: a table with a `patient_id` column, and the rows of other
    tables that belong to those (a milestone of a demo patient's pathway)."""
    for table in reversed(Base.metadata.sorted_tables):
        if table.name == AUDIT_TABLE:
            continue
        if "patient_id" in table.c:
            db.execute(table.delete().where(table.c.patient_id.in_(patient_ids)))
            continue
        for foreign_key in table.foreign_keys:
            parent = foreign_key.column.table
            if "patient_id" in parent.c:
                owned = select(foreign_key.column).where(parent.c.patient_id.in_(patient_ids))
                db.execute(table.delete().where(foreign_key.parent.in_(owned)))
    db.execute(delete(Patient).where(Patient.id.in_(patient_ids)))


def seed(db: Session, attach: list[str], rng: random.Random) -> dict[str, int]:
    coordinators, practitioners = _add_staff(db)
    attached = _find_attached(db, attach)
    practitioners += [u for u in attached if u.role == Role.PROFESSIONAL]
    coordinators += [u for u in attached if u.role == Role.COORDINATOR]
    patients = _add_patients(db, rng)
    teams = _add_care_teams(db, patients, coordinators, practitioners, rng)
    appointments = _add_appointments(db, teams, attached, rng)
    return {
        "staff": len(STAFF),
        "patients": len(patients),
        "care-team links": sum(len(team) for team in teams.values()),
        "appointments": appointments,
    }


def _add_staff(db: Session) -> tuple[list[User], list[User]]:
    coordinators, practitioners = [], []
    for full_name, role, discipline in STAFF:
        user = User(
            auth_subject=f"{DEMO_SUBJECT_PREFIX}{uuid.uuid4()}",
            email=f"{_slug(full_name)}@{DEMO_DOMAIN}",
            full_name=full_name,
            role=role,
            discipline=None if role == Role.COORDINATOR else discipline,
        )
        db.add(user)
        (coordinators if role == Role.COORDINATOR else practitioners).append(user)
    db.flush()
    return coordinators, practitioners


def _find_attached(db: Session, emails: list[str]) -> list[User]:
    attached = []
    for email in emails:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None or user.role not in {Role.PROFESSIONAL, Role.COORDINATOR}:
            raise SystemExit(f"{email}: no practitioner or coordinator account with this email.")
        attached.append(user)
    return attached


def _add_patients(db: Session, rng: random.Random) -> list[Patient]:
    patients = []
    for index, (first_name, last_name) in enumerate(PATIENTS):
        patient = Patient(
            first_name=first_name,
            last_name=last_name,
            birth_date=date(rng.randint(1950, 1995), rng.randint(1, 12), rng.randint(1, 28)),
            email=f"{_slug(f'{first_name} {last_name}')}@{DEMO_DOMAIN}",
            # 06 39 98 xx xx: a range ARCEP keeps for films and fiction, never given to anyone.
            phone=f"063998{index:04d}",
        )
        db.add(patient)
        patients.append(patient)
    db.flush()
    return patients


def _add_care_teams(
    db: Session,
    patients: list[Patient],
    coordinators: list[User],
    practitioners: list[User],
    rng: random.Random,
) -> dict[uuid.UUID, list[User]]:
    """Each patient: one coordinator and two or three practitioners."""
    teams = {}
    for index, patient in enumerate(patients):
        team = [coordinators[index % len(coordinators)]]
        team += rng.sample(practitioners, k=rng.choice([2, 3]))
        for member in team:
            db.add(CareAssignment(patient_id=patient.id, professional_id=member.id))
        teams[patient.id] = team
    db.flush()
    return teams


def _add_appointments(
    db: Session,
    teams: dict[uuid.UUID, list[User]],
    attached: list[User],
    rng: random.Random,
) -> int:
    """No practitioner and no patient is ever booked twice at the same time."""
    time_zone = institute_time_zone()
    today = datetime.now(time_zone).date()
    now = datetime.now(UTC)
    taken: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {}
    # An attached real login may already have sessions: demo ones go around them.
    existing = db.execute(
        select(Appointment.professional_id, Appointment.starts_at, Appointment.ends_at).where(
            Appointment.professional_id.in_([member.id for member in attached]),
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    )
    for member_id, starts, ends in existing:
        taken.setdefault(member_id, []).append((_utc(starts), _utc(ends)))
    patient_ids = list(teams)
    count = 0

    def is_free(person_id: uuid.UUID, starts: datetime, ends: datetime) -> bool:
        return all(ends <= s or starts >= e for s, e in taken.get(person_id, []))

    def book_at(patient_id: uuid.UUID, member: User, starts: datetime) -> None:
        nonlocal count
        ends = starts + (REVIEW if member.role == Role.COORDINATOR else SESSION)
        if not (is_free(member.id, starts, ends) and is_free(patient_id, starts, ends)):
            return
        for person_id in (member.id, patient_id):
            taken.setdefault(person_id, []).append((starts, ends))
        appointment = Appointment(
            patient_id=patient_id,
            professional_id=member.id,
            starts_at=starts,
            ends_at=ends,
            created_by=member.id,
        )
        _set_stage(appointment, now, rng)
        db.add(appointment)
        count += 1

    def book(patient_id: uuid.UUID, member: User, day: date, hour: int, minute: int) -> None:
        book_at(
            patient_id,
            member,
            datetime.combine(day, time(hour, minute), tzinfo=time_zone).astimezone(UTC),
        )

    # Rounded to five minutes, as people book; only what still falls on today's date.
    anchor = now.replace(minute=now.minute - now.minute % 5, second=0, microsecond=0)
    today_starts = [anchor + timedelta(minutes=m) for m in TODAY_OFFSETS]
    today_starts = [s for s in today_starts if s.astimezone(time_zone).date() == today]

    # Today: every patient once, so the board shows each stage of the waiting room.
    for patient_id, starts in zip(patient_ids, today_starts, strict=False):
        book_at(patient_id, rng.choice(teams[patient_id]), starts)
    for member in attached:  # an attached login gets a full morning
        own = [p for p in patient_ids if member in teams[p]]
        for patient_id, hour in zip(own, (9, 10, 11, 14, 15), strict=False):
            book(patient_id, member, today, hour, 30)

    for day in (_working_day(today, -1), *(_working_day(today, n) for n in range(1, 6))):
        for patient_id in rng.sample(patient_ids, k=8):
            book(patient_id, rng.choice(teams[patient_id]), day, rng.randint(9, 17), 0)
    db.flush()
    return count


def _set_stage(appointment: Appointment, now: datetime, rng: random.Random) -> None:
    """A believable status and waiting-room times for when the appointment is, relative to now."""
    starts, ends = appointment.starts_at, appointment.ends_at
    if ends <= now - timedelta(minutes=15):
        status = rng.choices(
            [AppointmentStatus.DONE, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
            weights=[8, 1, 1],
        )[0]
    elif starts <= now:
        # Mostly with the practitioner; sometimes still waiting, or late and not here yet.
        status = rng.choices(
            [AppointmentStatus.IN_SESSION, AppointmentStatus.ARRIVED, AppointmentStatus.SCHEDULED],
            weights=[6, 2, 2],
        )[0]
    elif starts <= now + timedelta(minutes=30):
        status = AppointmentStatus.ARRIVED
    else:
        status = rng.choices(
            [AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED], weights=[9, 1]
        )[0]
    appointment.status = status

    if status in {AppointmentStatus.ARRIVED, AppointmentStatus.IN_SESSION, AppointmentStatus.DONE}:
        arrival = min(starts, now) - timedelta(minutes=rng.randint(5, 20))
        appointment.arrived_at = arrival
    if status in {AppointmentStatus.IN_SESSION, AppointmentStatus.DONE}:
        appointment.called_in_at = min(starts + timedelta(minutes=rng.randint(0, 5)), now)
    if status == AppointmentStatus.CANCELLED:
        appointment.cancelled_at = min(starts - timedelta(days=1), now)
        appointment.cancel_reason = rng.choice(list(CancelReason))
    if rng.random() < 0.15:
        appointment.note = rng.choice(NOTES)


def _utc(value: datetime) -> datetime:
    """SQLite gives back naive datetimes; they are stored in UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _working_day(day: date, offset: int) -> date:
    """`offset` working days from `day`, skipping weekends."""
    step = 1 if offset > 0 else -1
    for _ in range(abs(offset)):
        day += timedelta(days=step)
        while day.weekday() >= 5:
            day += timedelta(days=step)
    return day


def _is_demo_email(column: InstrumentedAttribute[str | None]) -> ColumnElement[bool]:
    return column.endswith(f"@{DEMO_DOMAIN}")


def _slug(name: str) -> str:
    plain = name.lower().translate(str.maketrans("éèêëàâîïôöûüç’ ", "eeeeaaiioouuc-."))
    return "".join(ch for ch in plain if ch.isalnum() or ch in ".-")


if __name__ == "__main__":
    main()
