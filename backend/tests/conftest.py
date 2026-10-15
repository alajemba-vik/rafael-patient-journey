"""Shared test setup: a fresh in-memory database per test and a way to act as any user.

No Supabase needed: `client_as(role)` replaces the login check with a fake user.
"""

import uuid
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db, load_all_models
from app.main import app
from app.modules.identity_access.service import CurrentUser, Role, get_current_user


@pytest.fixture
def db() -> Iterator[Session]:
    load_all_models()
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    app.dependency_overrides[get_db] = lambda: session_factory()
    with session_factory() as session:
        yield session
    app.dependency_overrides.clear()


@pytest.fixture
def client_as(db: Session) -> Callable[[Role, uuid.UUID | None], TestClient]:
    """`client_as(Role.SECRETARY)` → a test client authenticated as a user with that role."""

    def make(role: Role, user_id: uuid.UUID | None = None) -> TestClient:
        user = CurrentUser(id=user_id or uuid.uuid4(), role=role)
        app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)

    return make
