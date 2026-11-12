"""add user is_active: admins deactivate a login without deleting the account

Existing accounts stay active.

Revision ID: 4b7e1c9a2d63
Revises: 09f8944d7222
Create Date: 2026-11-12 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4b7e1c9a2d63"
down_revision: str | None = "09f8944d7222"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False)
    )


def downgrade() -> None:
    op.drop_column("users", "is_active")
