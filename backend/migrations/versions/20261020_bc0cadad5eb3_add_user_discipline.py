"""add user discipline

Revision ID: bc0cadad5eb3
Revises: 47ed4b5c0d40
Create Date: 2026-10-20 22:12:50.353037
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "bc0cadad5eb3"
down_revision: str | None = "47ed4b5c0d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("discipline", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "discipline")
