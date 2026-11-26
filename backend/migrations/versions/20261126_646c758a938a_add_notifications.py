"""add notifications: a user's in-app inbox

Revision ID: 646c758a938a
Revises: 09f8944d7222
Create Date: 2026-11-26 07:35:43.326041
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '646c758a938a'
down_revision: str | None = '09f8944d7222'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('notifications',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('recipient_id', sa.Uuid(), nullable=False),
    sa.Column('channel', sa.Enum('in_app', name='channel', native_enum=False, length=16), nullable=False),
    sa.Column('template', sa.Enum('appointment_booked', 'appointment_moved', 'appointment_cancelled', 'appointment_reminder', 'missed_appointment', 'message_received', 'session_to_rate', name='template', native_enum=False, length=32), nullable=False),
    sa.Column('subject_id', sa.Uuid(), nullable=True),
    sa.Column('params', sa.JSON(), nullable=False),
    sa.Column('status', sa.Enum('unread', 'read', name='status', native_enum=False, length=16), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("status IN ('unread', 'read')", name='ck_notifications_status_valid'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_recipient_sent', 'notifications', ['recipient_id', 'sent_at'], unique=False)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index('ix_notifications_recipient_sent', table_name='notifications')
    op.drop_table('notifications')
