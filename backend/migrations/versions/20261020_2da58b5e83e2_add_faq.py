"""add faq

Revision ID: 2da58b5e83e2
Revises: 1173e57fc9e0
Create Date: 2026-10-20 21:46:28.761062
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "2da58b5e83e2"
down_revision: str | None = "1173e57fc9e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "faq_categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "faq_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("question", sa.String(length=300), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["faq_categories.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_faq_entries_category_id"), "faq_entries", ["category_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_faq_entries_category_id"), table_name="faq_entries")
    op.drop_table("faq_entries")
    op.drop_table("faq_categories")
