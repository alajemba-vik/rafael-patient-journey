"""API server for the browser end-to-end tests (`frontend/e2e/`), never for real use.

It runs the real app on a throwaway SQLite file with synthetic data. The only thing faked
is the identity provider: the bearer token is taken as the login's identity, so the browser
signs in as `e2e-secretary` without Supabase. Everything else (permissions, audit, rules)
is the production code.

Run: `uv run python -m tests.e2e.server` (Playwright starts it by itself).
"""

import os
import tempfile
import uuid
from datetime import date
from pathlib import Path

import uvicorn

PORT = int(os.environ.get("E2E_API_PORT", "8100"))
DATABASE_FILE = Path(tempfile.gettempdir()) / "rafael-e2e.db"

WEB_ORIGIN = os.environ.get("E2E_WEB_ORIGIN", "http://localhost:5180")

# Always a fresh local SQLite file, never a real database: this server trusts any token.
DATABASE_FILE.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{DATABASE_FILE}"
os.environ["APP_ENV"] = "local"
os.environ["CORS_ORIGINS"] = f'["{WEB_ORIGIN}"]'
os.environ.pop("VERCEL", None)

from app import auth  # noqa: E402  (settings above must be in place before the app loads)
from app.db import Base, SessionLocal, engine, load_all_models  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.care_team.models import CareAssignment  # noqa: E402
from app.modules.identity_access.models import Role, User  # noqa: E402
from app.modules.patients.models import Patient  # noqa: E402

# The browser's token is the account's identity-provider subject.
auth.verify_token = lambda token: token


def seed() -> None:
    """Reception, one practitioner, and one patient already in that practitioner's care."""
    load_all_models()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(
            User(
                auth_subject="e2e-secretary",
                email="accueil@e2e.invalid",
                full_name="Camille Accueil",
                role=Role.SECRETARY,
            )
        )
        practitioner = User(
            id=uuid.uuid4(),
            auth_subject="e2e-professional",
            email="praticien@e2e.invalid",
            full_name="Jordan Praticien",
            role=Role.PROFESSIONAL,
            discipline="Yoga",
        )
        patient = Patient(
            id=uuid.uuid4(), first_name="Alex", last_name="Synthetic", birth_date=date(1975, 5, 5)
        )
        db.add_all([practitioner, patient])
        db.add(CareAssignment(professional_id=practitioner.id, patient_id=patient.id))
        db.commit()


if __name__ == "__main__":
    seed()
    uvicorn.run(app, host="127.0.0.1", port=PORT)
