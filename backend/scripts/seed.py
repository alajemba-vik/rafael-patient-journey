"""Fill an empty database with synthetic demo data so the app has something to show.

Usage, after `uv run alembic upgrade head` and with Supabase set in `.env`:

    SEED_PASSWORD='<at least 12 characters>' uv run python -m scripts.seed

Every account gets SEED_PASSWORD, so the password never lives in the repo. Runs only on a
database with no admin yet. Everything goes through the modules' services, so the usual
rules and audit apply. All people here are fictional.
"""

import logging
import os
import sys
import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.errors import ForbiddenError
from app.modules.care_team import service as care_team
from app.modules.care_team.schemas import AssignmentCreate
from app.modules.identity_access import service as identity
from app.modules.identity_access.schemas import AccountCreate, UserCreate
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients import service as patients
from app.modules.patients.schemas import PatientCreate

logger = logging.getLogger("seed")

ADMIN = ("admin@example.com", "Sam Admin")
STAFF = [
    ("accueil@example.com", "Morgan Accueil", Role.SECRETARY),
    ("coordination@example.com", "Claire Coordination", Role.COORDINATOR),
    ("praticien@example.com", "Jordan Praticien", Role.PROFESSIONAL),
]
# (email or None for a patient without a login, first name, last name, birth date)
PATIENTS = [
    ("alex.synthetic@example.com", "Alex", "Synthetic", date(1975, 5, 5)),
    ("camille.exemple@example.com", "Camille", "Exemple", date(1982, 11, 21)),
    (None, "Dominique", "Fictif", date(1968, 2, 14)),
]


def seed(db: Session, password: str) -> None:
    email, full_name = ADMIN
    admin = identity.bootstrap_admin(
        db, AccountCreate(email=email, full_name=full_name, password=password)
    )
    actor = CurrentUser(id=admin.id, role=Role.ADMIN)
    logger.info("admin: %s", email)

    staff_ids = {}
    for email, full_name, role in STAFF:
        account = identity.create_user(
            db, actor, UserCreate(email=email, full_name=full_name, password=password, role=role)
        )
        staff_ids[role] = account.id
        logger.info("%s: %s", role.value, email)

    patient_ids = _seed_patients(db, actor, password)

    # The first patient is followed by the coordinator and the practitioner.
    for role in (Role.COORDINATOR, Role.PROFESSIONAL):
        care_team.create_assignment(
            db, actor, AssignmentCreate(patient_id=patient_ids[0], professional_id=staff_ids[role])
        )
    logger.info("care team: coordinator and practitioner follow the first patient")


def _seed_patients(db: Session, actor: CurrentUser, password: str) -> list[uuid.UUID]:
    patient_ids = []
    for email, first_name, last_name, birth_date in PATIENTS:
        user_id = None
        if email is not None:
            account = identity.create_user(
                db,
                actor,
                UserCreate(
                    email=email,
                    full_name=f"{first_name} {last_name}",
                    password=password,
                    role=Role.PATIENT,
                ),
            )
            user_id = account.id
        patient = patients.create_patient(
            db,
            actor,
            PatientCreate(
                first_name=first_name,
                last_name=last_name,
                birth_date=birth_date,
                email=email,
                user_id=user_id,
            ),
        )
        patient_ids.append(patient.id)
        logger.info("patient: %s %s (%s)", first_name, last_name, email or "no login")
    return patient_ids


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    password = os.environ.get("SEED_PASSWORD", "")
    if len(password) < 12:
        logger.error("Set SEED_PASSWORD to at least 12 characters.")
        return 1
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_secret_key:
        logger.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.")
        return 1
    with SessionLocal() as db:
        try:
            seed(db, password)
        except ForbiddenError:
            logger.error("This database already has an admin: seed only runs on an empty one.")
            return 1
    logger.info("Done. Every account uses SEED_PASSWORD.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
