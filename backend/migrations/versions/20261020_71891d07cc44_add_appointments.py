"""add appointments

Revision ID: 71891d07cc44
Revises: 2da58b5e83e2
Create Date: 2026-10-20 21:58:52.792319
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "71891d07cc44"
down_revision: str | None = "2da58b5e83e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "appointments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("professional_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "scheduled",
                "arrived",
                "done",
                "no_show",
                "cancelled",
                name="appointmentstatus",
                native_enum=False,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_appointments_patient_start", "appointments", ["patient_id", "starts_at"], unique=False
    )
    op.create_index(
        "ix_appointments_professional_start",
        "appointments",
        ["professional_id", "starts_at"],
        unique=False,
    )
    op.create_index(op.f("ix_appointments_starts_at"), "appointments", ["starts_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_appointments_starts_at"), table_name="appointments")
    op.drop_index("ix_appointments_professional_start", table_name="appointments")
    op.drop_index("ix_appointments_patient_start", table_name="appointments")
    op.drop_table("appointments")
