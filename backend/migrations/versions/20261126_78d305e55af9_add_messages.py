"""add messages: one conversation per patient with their care team

Revision ID: 78d305e55af9
Revises: 646c758a938a
Create Date: 2026-11-26 07:39:46.551523
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '78d305e55af9'
down_revision: str | None = '646c758a938a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('messages',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('patient_id', sa.Uuid(), nullable=False),
    sa.Column('sender_id', sa.Uuid(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_messages_patient_sent', 'messages', ['patient_id', 'sent_at'], unique=False)
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE messages ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index('ix_messages_patient_sent', table_name='messages')
    op.drop_table('messages')
