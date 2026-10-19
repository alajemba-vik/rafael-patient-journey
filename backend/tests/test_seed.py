"""The demo seed fills an empty database through the services, and refuses to run twice."""

import uuid

import pytest
from sqlalchemy import func, select

from app import auth
from app.errors import ForbiddenError
from app.modules.identity_access.models import User
from app.modules.patients.models import Patient
from scripts.seed import PATIENTS, STAFF, seed

PASSWORD = "synthetic-password-1"


@pytest.fixture(autouse=True)
def fake_identity_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "create_account", lambda email, password: str(uuid.uuid4()))


def test_seed_creates_staff_patients_and_links_patient_logins(db):
    seed(db, PASSWORD)

    patients_with_login = [p for p in PATIENTS if p[0] is not None]
    assert db.scalar(select(func.count(User.id))) == 1 + len(STAFF) + len(patients_with_login)
    assert db.scalar(select(func.count(Patient.id))) == len(PATIENTS)
    assert db.scalar(select(func.count(Patient.user_id))) == len(patients_with_login)


def test_seed_refuses_a_database_that_already_has_an_admin(db):
    seed(db, PASSWORD)

    with pytest.raises(ForbiddenError):
        seed(db, PASSWORD)
