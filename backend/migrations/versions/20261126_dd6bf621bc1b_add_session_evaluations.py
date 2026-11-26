"""add session evaluations: patient and practitioner ratings of each finished session

Revision ID: dd6bf621bc1b
Revises: 78d305e55af9
Create Date: 2026-11-26 07:44:18.615145
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'dd6bf621bc1b'
down_revision: str | None = '78d305e55af9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('session_evaluations',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('appointment_id', sa.Uuid(), nullable=False),
    sa.Column('patient_id', sa.Uuid(), nullable=False),
    sa.Column('professional_id', sa.Uuid(), nullable=False),
    sa.Column('patient_difficulty', sa.SmallInteger(), nullable=True),
    sa.Column('patient_satisfaction', sa.SmallInteger(), nullable=True),
    sa.Column('patient_rated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('coping', sa.SmallInteger(), nullable=True),
    sa.Column('intensity_mets', sa.Float(), nullable=True),
    sa.Column('practitioner_rated_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('coping IS NULL OR coping BETWEEN 0 AND 4', name='ck_session_evaluations_coping_range'),
    sa.CheckConstraint('intensity_mets IS NULL OR intensity_mets BETWEEN 0.5 AND 25', name='ck_session_evaluations_mets_range'),
    sa.CheckConstraint('patient_difficulty IS NULL OR patient_difficulty BETWEEN 0 AND 4', name='ck_session_evaluations_difficulty_range'),
    sa.CheckConstraint('patient_satisfaction IS NULL OR patient_satisfaction BETWEEN 0 AND 4', name='ck_session_evaluations_satisfaction_range'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('appointment_id')
    )
    op.create_index(op.f('ix_session_evaluations_patient_id'), 'session_evaluations', ['patient_id'], unique=False)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE session_evaluations ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f('ix_session_evaluations_patient_id'), table_name='session_evaluations')
    op.drop_table('session_evaluations')
