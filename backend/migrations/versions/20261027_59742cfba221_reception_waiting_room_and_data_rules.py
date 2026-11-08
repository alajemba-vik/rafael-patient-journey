"""reception waiting room and data rules

Adds what reception needs to run the waiting room and manage appointments without paper:
arrival and call-in times, why and when an appointment was cancelled, and a short staff
note. Adds database rules so bad values can't be written by any client, and stores every
patient phone number in one form so reception can search by number.

Revision ID: 59742cfba221
Revises: de6a5d7b9595
Create Date: 2026-10-27 02:00:53.251198
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "59742cfba221"
down_revision: str | None = "de6a5d7b9595"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = ("scheduled", "arrived", "in_session", "done", "no_show", "cancelled")
CANCEL_REASONS = ("patient_request", "practitioner_unavailable", "other")

# Written by hand: autogenerate doesn't detect check constraints. Same names as in models.py.
APPOINTMENT_CHECKS = {
    "ck_appointments_status_valid": f"status IN {STATUSES}",
    "ck_appointments_cancel_reason_valid": (
        f"cancel_reason IS NULL OR cancel_reason IN {CANCEL_REASONS}"
    ),
    "ck_appointments_cancel_reason_only_if_cancelled": (
        "cancel_reason IS NULL OR status = 'cancelled'"
    ),
    "ck_appointments_called_in_after_arrival": "called_in_at IS NULL OR arrived_at IS NOT NULL",
}


def upgrade() -> None:
    with op.batch_alter_table("appointments") as batch:
        batch.add_column(sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("called_in_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column(
                "cancel_reason",
                sa.Enum(*CANCEL_REASONS, name="cancelreason", native_enum=False, length=32),
                nullable=True,
            )
        )
        batch.add_column(sa.Column("note", sa.String(length=280), nullable=True))
        for name, condition in APPOINTMENT_CHECKS.items():
            batch.create_check_constraint(name, condition)

    with op.batch_alter_table("patients") as batch:
        batch.create_check_constraint(
            "ck_patients_birth_date_after_1900", "birth_date >= '1900-01-01'"
        )

    _normalize_phones()


def downgrade() -> None:
    # Phone numbers stay in their normalized form: the original spacing isn't kept anywhere.
    # The previous code knows no "in session" status: those patients go back to the waiting room.
    appointments = sa.table("appointments", sa.column("status", sa.String))
    op.execute(
        appointments.update()
        .where(appointments.c.status == "in_session")
        .values(status="arrived")
    )
    with op.batch_alter_table("patients") as batch:
        batch.drop_constraint("ck_patients_birth_date_after_1900", type_="check")

    with op.batch_alter_table("appointments") as batch:
        for name in APPOINTMENT_CHECKS:
            batch.drop_constraint(name, type_="check")
        batch.drop_column("note")
        batch.drop_column("cancel_reason")
        batch.drop_column("cancelled_at")
        batch.drop_column("called_in_at")
        batch.drop_column("arrived_at")


def _normalize_phones() -> None:
    """Same rule as patients.schemas.normalize_phone, copied so this migration never changes
    if that code does. Numbers that don't look like phone numbers are left untouched."""
    patients = sa.table("patients", sa.column("id", sa.Uuid), sa.column("phone", sa.String))
    connection = op.get_bind()
    rows = connection.execute(sa.select(patients.c.id, patients.c.phone).where(patients.c.phone.is_not(None)))
    for patient_id, phone in rows.all():
        digits = re.sub(r"\D", "", phone)
        international = phone.strip().startswith("+") or digits.startswith("00")
        if digits.startswith("00"):
            digits = digits[2:]
        if not 6 <= len(digits) <= 15:
            continue
        if international and digits.startswith("33") and len(digits) == 11:
            normalized = "0" + digits[2:]  # French numbers are stored as read out: 06…
        else:
            normalized = f"+{digits}" if international else digits
        if normalized != phone:
            connection.execute(
                patients.update().where(patients.c.id == patient_id).values(phone=normalized)
            )
