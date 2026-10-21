"""add questionnaire responses

Revision ID: 47ed4b5c0d40
Revises: e9128369291a
Create Date: 2026-10-20 22:06:43.257388
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "47ed4b5c0d40"
down_revision: str | None = "e9128369291a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "questionnaire_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column(
            "instrument",
            sa.Enum(
                "quality_of_life", "satisfaction", name="instrument", native_enum=False, length=24
            ),
            nullable=False,
        ),
        sa.Column("period", sa.String(length=64), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patient_id", "instrument", "period"),
    )


def downgrade() -> None:
    op.drop_table("questionnaire_responses")
