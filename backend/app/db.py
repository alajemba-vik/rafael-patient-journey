"""Database engine, session and model base. The only place that knows the connection string."""

import importlib
import logging
import pkgutil
from collections.abc import Iterator
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for every table in the app."""


def engine_options(settings: Settings) -> dict[str, Any]:
    """How to connect, depending on where the API runs.

    - A long-running server keeps a small pool of connections and checks each before use.
    - Serverless instances (Vercel) start and stop all the time and many run at once: each
      keeping its own pool would exhaust Supabase's connection limit. They open one
      connection per request (`NullPool`) through Supabase's **transaction pooler**
      (port 6543), which shares a few real connections between them. That pooler doesn't
      support prepared statements, so psycopg must not create any.
    """
    if not settings.is_serverless:
        return {"pool_pre_ping": True}
    options: dict[str, Any] = {"poolclass": NullPool}
    if settings.database_url.startswith("postgresql+psycopg"):
        options["connect_args"] = {"prepare_threshold": None}
    return options


_settings = get_settings()
engine = create_engine(_settings.database_url, **engine_options(_settings))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service that writes."""
    with SessionLocal() as session:
        yield session


def is_database_reachable(session: Session) -> bool:
    """For the health check: can we run a trivial query right now?"""
    try:
        session.execute(select(1))
    except SQLAlchemyError as error:
        logger.error("Database unreachable: %s", type(error).__name__)
        return False
    return True


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
