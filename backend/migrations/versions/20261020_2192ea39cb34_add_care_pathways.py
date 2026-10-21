"""add care pathways

Revision ID: 2192ea39cb34
Revises: 71891d07cc44
Create Date: 2026-10-20 22:02:24.637146
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "2192ea39cb34"
down_revision: str | None = "71891d07cc44"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "care_pathways",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("coordinator_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("open", "closed", name="pathwaystatus", native_enum=False, length=8),
            nullable=False,
        ),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_care_pathways_coordinator_id"), "care_pathways", ["coordinator_id"], unique=False
    )
    op.create_index(
        op.f("ix_care_pathways_patient_id"), "care_pathways", ["patient_id"], unique=False
    )
    op.create_table(
        "pathway_milestones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pathway_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("intake", "review", "final", name="milestonekind", native_enum=False, length=8),
            nullable=False,
        ),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
        sa.Column("physical", sa.SmallInteger(), nullable=False),
        sa.Column("psychological", sa.SmallInteger(), nullable=False),
        sa.Column("emotional", sa.SmallInteger(), nullable=False),
        sa.Column("sexual", sa.SmallInteger(), nullable=False),
        sa.Column("socio_professional", sa.SmallInteger(), nullable=False),
        sa.Column("symptoms", sa.JSON(), nullable=False),
        sa.Column("goals", sa.Text(), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["pathway_id"],
            ["care_pathways.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pathway_id", "kind"),
    )
    op.create_index(
        op.f("ix_pathway_milestones_pathway_id"), "pathway_milestones", ["pathway_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pathway_milestones_pathway_id"), table_name="pathway_milestones")
    op.drop_table("pathway_milestones")
    op.drop_index(op.f("ix_care_pathways_patient_id"), table_name="care_pathways")
    op.drop_index(op.f("ix_care_pathways_coordinator_id"), table_name="care_pathways")
    op.drop_table("care_pathways")
