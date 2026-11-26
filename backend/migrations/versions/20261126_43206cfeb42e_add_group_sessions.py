"""add group sessions: one practitioner, several enrolled patients, attendance

Revision ID: 43206cfeb42e
Revises: 94e89b1d2333
Create Date: 2026-11-26 10:06:41.272132
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '43206cfeb42e'
down_revision: str | None = '94e89b1d2333'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('group_sessions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('professional_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('capacity', sa.SmallInteger(), nullable=False),
    sa.Column('status', sa.Enum('scheduled', 'cancelled', name='groupsessionstatus', native_enum=False, length=16), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=False),
    sa.CheckConstraint("status IN ('scheduled', 'cancelled')", name='ck_group_sessions_status_valid'),
    sa.CheckConstraint('capacity BETWEEN 1 AND 30', name='ck_group_sessions_capacity_range'),
    sa.CheckConstraint('ends_at > starts_at', name='ck_group_sessions_ends_after_start'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_group_sessions_professional_start', 'group_sessions', ['professional_id', 'starts_at'], unique=False)
    op.create_index(op.f('ix_group_sessions_starts_at'), 'group_sessions', ['starts_at'], unique=False)
    op.create_table('group_enrollments',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('session_id', sa.Uuid(), nullable=False),
    sa.Column('patient_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('enrolled', 'attended', 'no_show', name='enrollmentstatus', native_enum=False, length=16), nullable=False),
    sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("status IN ('enrolled', 'attended', 'no_show')", name='ck_group_enrollments_status_valid'),
    sa.ForeignKeyConstraint(['session_id'], ['group_sessions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id', 'patient_id')
    )
    op.create_index(op.f('ix_group_enrollments_patient_id'), 'group_enrollments', ['patient_id'], unique=False)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE group_enrollments ENABLE ROW LEVEL SECURITY")

def downgrade() -> None:
    op.drop_index(op.f('ix_group_enrollments_patient_id'), table_name='group_enrollments')
    op.drop_table('group_enrollments')
    op.drop_index(op.f('ix_group_sessions_starts_at'), table_name='group_sessions')
    op.drop_index('ix_group_sessions_professional_start', table_name='group_sessions')
    op.drop_table('group_sessions')
