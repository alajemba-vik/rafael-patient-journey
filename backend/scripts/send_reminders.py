"""Remind patients of their appointments in the next 24 hours, in their in-app inbox.

Run on a schedule (every hour, for example) or by hand:

    cd backend && uv run python -m scripts.send_reminders

Each appointment gets one reminder, however often this runs.
"""

from app.db import SessionLocal
from app.modules.scheduling import service as scheduling


def main() -> None:
    with SessionLocal() as db:
        sent = scheduling.send_appointment_reminders(db)
    print(f"{sent} reminder(s) sent")


if __name__ == "__main__":
    main()
