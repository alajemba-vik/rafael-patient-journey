"""protect audit events: never changed, kept at least a year

Postgres only (Supabase and CI); SQLite (local runs, tests) skips this migration.

The audit trail answers "who saw or changed this patient's data". `app/audit.py` only ever
inserts, but nothing stopped a bug, a script or someone in the database console from
editing or deleting rows. A trigger now refuses:
- any UPDATE: an audit event is a fact, it is never corrected;
- any DELETE of an event younger than the retention period;
- TRUNCATE, which would empty the table without going through the row check.

Older events can be deleted (a purge job, when the Institute sets the rule). The trigger
applies to every role, the table owner included; only a superuser can switch it off.

TODO(validate): the retention period. One year is a working assumption, in line with the
CNIL's usual guidance for access logs (six months to a year); the Institute's data protection
officer may require longer for health data.

Revision ID: 09f8944d7222
Revises: 9c41d2e7f0ab
Create Date: 2026-11-08 14:26:57
"""

from collections.abc import Sequence

from alembic import op

revision: str = "09f8944d7222"
down_revision: str | None = "9c41d2e7f0ab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RETENTION = "1 year"


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(
        f"""
        CREATE FUNCTION audit_events_protect() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                RAISE EXCEPTION 'audit events are never changed';
            END IF;
            IF TG_OP = 'TRUNCATE' THEN
                RAISE EXCEPTION 'audit events can only be deleted one by one, once expired';
            END IF;
            IF OLD.occurred_at > now() - interval '{RETENTION}' THEN
                RAISE EXCEPTION 'audit events are kept for at least {RETENTION}';
            END IF;
            RETURN OLD;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_protect_rows
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION audit_events_protect()
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_protect_table
        BEFORE TRUNCATE ON audit_events
        FOR EACH STATEMENT EXECUTE FUNCTION audit_events_protect()
        """
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP TRIGGER IF EXISTS audit_events_protect_table ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_protect_rows ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS audit_events_protect()")
