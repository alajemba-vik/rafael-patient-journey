"""The demo seed: believable, never overlapping, and removable without touching real data."""

import random
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.care_team.models import CareAssignment
from app.modules.identity_access.models import Role, User
from app.modules.pathways.models import CarePathway, MilestoneKind, PathwayMilestone
from app.modules.patients.models import Patient
from app.modules.scheduling.models import Appointment, AppointmentStatus
from scripts.seed_demo import remove_demo_data, seed


def count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model))


def overlaps(appointments: list[Appointment], key: str) -> bool:
    live = [a for a in appointments if a.status != AppointmentStatus.CANCELLED]
    return any(
        getattr(a, key) == getattr(b, key) and a.starts_at < b.ends_at and b.starts_at < a.ends_at
        for i, a in enumerate(live)
        for b in live[i + 1 :]
    )


def test_seed_books_nobody_twice_at_the_same_time(db):
    seed(db, attach=[], rng=random.Random(1))
    db.commit()

    appointments = list(db.scalars(select(Appointment)))

    assert len(appointments) > 30
    assert not overlaps(appointments, "professional_id")
    assert not overlaps(appointments, "patient_id")


def test_every_demo_appointment_is_with_someone_in_the_patients_care_team(db):
    seed(db, attach=[], rng=random.Random(2))
    db.commit()

    team = {(a.patient_id, a.professional_id) for a in db.scalars(select(CareAssignment))}

    assert all((a.patient_id, a.professional_id) in team for a in db.scalars(select(Appointment)))


def test_attached_login_joins_the_demo_care_teams(db):
    real = User(
        auth_subject="real", email="pro@example.org", full_name="Real Pro", role=Role.PROFESSIONAL
    )
    db.add(real)
    db.commit()

    seed(db, attach=["pro@example.org"], rng=random.Random(3))
    db.commit()

    query = select(func.count()).where(CareAssignment.professional_id == real.id)
    assert db.scalar(query) > 0


def test_removing_the_demo_leaves_real_records_alone(db):
    real_staff = User(
        auth_subject="real", email="pro@example.org", full_name="Real Pro", role=Role.PROFESSIONAL
    )
    real_patient = Patient(first_name="Alex", last_name="Synthetic", birth_date=date(1975, 5, 5))
    db.add_all([real_staff, real_patient])
    db.commit()
    real_assignment = CareAssignment(patient_id=real_patient.id, professional_id=real_staff.id)
    db.add(real_assignment)
    db.commit()
    seed(db, attach=["pro@example.org"], rng=random.Random(4))
    db.commit()

    remove_demo_data(db)
    db.commit()

    assert [p.id for p in db.scalars(select(Patient))] == [real_patient.id]
    assert [u.id for u in db.scalars(select(User))] == [real_staff.id]
    assert [a.id for a in db.scalars(select(CareAssignment))] == [real_assignment.id]
    assert count(db, Appointment) == 0


def test_seeding_twice_replaces_rather_than_doubles(db):
    for run in range(2):
        remove_demo_data(db)
        seed(db, attach=[], rng=random.Random(run))
        db.commit()

    assert count(db, Patient) == 16
    assert all(isinstance(p.id, uuid.UUID) for p in db.scalars(select(Patient)))


def test_removing_the_demo_also_removes_what_other_modules_hold_about_demo_patients(db):
    seed(db, attach=[], rng=random.Random(5))
    db.commit()
    demo_patient = db.scalars(select(Patient)).first()
    pathway = CarePathway(
        patient_id=demo_patient.id, coordinator_id=uuid.uuid4(), opened_at=datetime.now(UTC)
    )
    db.add(pathway)
    db.flush()
    db.add(
        PathwayMilestone(
            pathway_id=pathway.id,
            kind=MilestoneKind.INTAKE,
            recorded_at=datetime.now(UTC),
            recorded_by=uuid.uuid4(),
            physical=2,
            psychological=2,
            emotional=2,
            sexual=2,
            socio_professional=2,
        )
    )
    db.commit()

    remove_demo_data(db)
    db.commit()

    assert count(db, CarePathway) == 0
    assert count(db, PathwayMilestone) == 0


def test_an_attached_logins_own_sessions_are_never_overlapped(db):
    real = User(
        auth_subject="real", email="pro@example.org", full_name="Real Pro", role=Role.PROFESSIONAL
    )
    db.add(real)
    db.commit()
    own = datetime.now(UTC).replace(second=0, microsecond=0)
    db.add(
        Appointment(
            patient_id=uuid.uuid4(),
            professional_id=real.id,
            starts_at=own - timedelta(hours=12),
            ends_at=own + timedelta(hours=12),
            created_by=real.id,
        )
    )
    db.commit()

    seed(db, attach=["pro@example.org"], rng=random.Random(6))
    db.commit()

    assert not overlaps(list(db.scalars(select(Appointment))), "professional_id")
