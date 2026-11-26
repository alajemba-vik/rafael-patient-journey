"""add assessments and care plan: scored tests of the assessment day, goals and disciplines

Revision ID: 94e89b1d2333
Revises: dd6bf621bc1b
Create Date: 2026-11-26 09:57:43.101416
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '94e89b1d2333'
down_revision: str | None = 'dd6bf621bc1b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('assessment_scores',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('pathway_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.Enum('intake', 'review', 'final', name='milestonekind', native_enum=False, length=8), nullable=False),
    sa.Column('test', sa.Enum('k10', 'mna_screening', 'marshall', 'sitting_hours', 'balance_right', 'balance_left', 'sit_to_stand', 'handgrip', name='assessmenttest', native_enum=False, length=16), nullable=False),
    sa.Column('value', sa.Float(), nullable=False),
    sa.Column('recorded_by', sa.Uuid(), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['pathway_id'], ['care_pathways.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('pathway_id', 'kind', 'test'),
    sa.CheckConstraint('value >= 0', name='ck_assessment_scores_value_positive')
    )
    op.add_column('pathway_milestones', sa.Column('goal_codes', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('pathway_milestones', sa.Column('discipline_codes', sa.JSON(), server_default='[]', nullable=False))
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_column('pathway_milestones', 'discipline_codes')
    op.drop_column('pathway_milestones', 'goal_codes')
    op.drop_table('assessment_scores')
