"""enforce one open pathway and appointment order

Revision ID: de6a5d7b9595
Revises: ae83e9224d36
Create Date: 2026-10-21 06:44:54.450555
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "de6a5d7b9595"
down_revision: str | None = "ae83e9224d36"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The database refuses a second open pathway for a patient, even if two requests race.
    op.create_index(
        "uq_care_pathways_one_open_per_patient",
        "care_pathways",
        ["patient_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
        sqlite_where=sa.text("status = 'open'"),
    )
    # Written by hand: autogenerate doesn't detect check constraints. Batch mode lets SQLite
    # (local runs and tests) add a constraint too; on Postgres it is a plain ALTER TABLE.
    with op.batch_alter_table("appointments") as batch:
        batch.create_check_constraint("ck_appointments_ends_after_start", "ends_at > starts_at")


def downgrade() -> None:
    with op.batch_alter_table("appointments") as batch:
        batch.drop_constraint("ck_appointments_ends_after_start", type_="check")
    op.drop_index("uq_care_pathways_one_open_per_patient", table_name="care_pathways")
