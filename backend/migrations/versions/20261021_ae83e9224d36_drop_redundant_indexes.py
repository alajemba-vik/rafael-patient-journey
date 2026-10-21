"""drop redundant indexes

Revision ID: ae83e9224d36
Revises: bc0cadad5eb3
Create Date: 2026-10-21 06:36:14.499801
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "ae83e9224d36"
down_revision: str | None = "bc0cadad5eb3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_care_assignments_patient_id"), table_name="care_assignments")
    op.drop_index(op.f("ix_pathway_milestones_pathway_id"), table_name="pathway_milestones")


def downgrade() -> None:
    op.create_index(
        op.f("ix_pathway_milestones_pathway_id"), "pathway_milestones", ["pathway_id"], unique=False
    )
    op.create_index(
        op.f("ix_care_assignments_patient_id"), "care_assignments", ["patient_id"], unique=False
    )
