"""Database engine, session and model base. The only place that knows the connection string."""

import importlib
import pkgutil
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Base class for every table in the app."""


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service that writes."""
    with SessionLocal() as session:
        yield session


def load_all_models() -> None:
    """Import every `app.modules.<name>.models` so Alembic and tests see all tables."""
    import app.audit  # noqa: F401  (shared audit table)
    import app.modules as modules

    for module in pkgutil.iter_modules(modules.__path__):
        try:
            importlib.import_module(f"app.modules.{module.name}.models")
        except ModuleNotFoundError as error:
            if error.name != f"app.modules.{module.name}.models":
                raise
