"""postgres hardening: no overlapping appointments, row-level security

Postgres only (Supabase and CI); SQLite (local runs, tests) skips this migration.

1. No overlapping appointments. The API already checks for overlaps before booking, but two
   people booking the same slot at the same instant could both pass that check. Exclusion
   constraints make the database refuse the second one. Cancelled appointments don't count.

2. Row-level security on every table. Supabase publishes the `public` schema through its
   automatic REST API, and its anonymous and logged-in roles can read any table that has
   no row-level security. Turning it on with no policies closes that door. The API connects
   as the tables' owner, which row-level security doesn't restrict, so the app is unaffected.
   Any table created in a later migration must turn it on too (see AGENTS.md, Migrations).

Revision ID: 9c41d2e7f0ab
Revises: 59742cfba221
Create Date: 2026-10-27 02:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9c41d2e7f0ab"
down_revision: str | None = "59742cfba221"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Constraint names contain "no_overlap": scheduling.service reports their violation as a
# taken slot (409) instead of a server error.
NO_OVERLAP = {
    "ex_appointments_professional_no_overlap": "professional_id",
    "ex_appointments_patient_no_overlap": "patient_id",
}


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    # Lets a gist index compare uuids with "=". Supabase ships it; it may already be enabled.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    _refuse_if_overlaps_exist()
    for name, column in NO_OVERLAP.items():
        op.execute(
            f"ALTER TABLE appointments ADD CONSTRAINT {name} "
            f"EXCLUDE USING gist ({column} WITH =, tstzrange(starts_at, ends_at) WITH &&) "
            "WHERE (status <> 'cancelled')"
        )
    _set_row_level_security(enabled=True)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    _set_row_level_security(enabled=False)
    for name in NO_OVERLAP:
        op.execute(f"ALTER TABLE appointments DROP CONSTRAINT IF EXISTS {name}")
    # btree_gist stays: other objects may rely on it, and keeping it is harmless.


def _refuse_if_overlaps_exist() -> None:
    """Existing overlaps would make the constraint fail with a cryptic error: say what to fix."""
    for column in NO_OVERLAP.values():
        overlapping = op.get_bind().scalar(
            sa.text(
                f"SELECT count(*) FROM appointments a JOIN appointments b "
                f"ON a.{column} = b.{column} AND a.id < b.id "
                "AND a.status <> 'cancelled' AND b.status <> 'cancelled' "
                "AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at"
            )
        )
        if overlapping:
            raise RuntimeError(
                f"{overlapping} pair(s) of appointments overlap for the same {column}. "
                "Cancel or move one of each pair, then run the migration again."
            )


def _set_row_level_security(enabled: bool) -> None:
    """Every table in the public schema, including alembic_version."""
    action = "ENABLE" if enabled else "DISABLE"
    op.execute(
        f"""
        DO $$
        DECLARE t record;
        BEGIN
            FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                EXECUTE format('ALTER TABLE public.%I {action} ROW LEVEL SECURITY', t.tablename);
            END LOOP;
        END $$;
        """
    )
