"""add pathway needs

Revision ID: e9128369291a
Revises: 2192ea39cb34
Create Date: 2026-10-20 22:04:11.565900
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e9128369291a"
down_revision: str | None = "2192ea39cb34"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pathway_needs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pathway_id", sa.Uuid(), nullable=False),
        sa.Column("raised_by", sa.Uuid(), nullable=False),
        sa.Column("raised_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["pathway_id"],
            ["care_pathways.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pathway_needs_pathway_id"), "pathway_needs", ["pathway_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pathway_needs_pathway_id"), table_name="pathway_needs")
    op.drop_table("pathway_needs")
