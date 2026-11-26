"""In-app notifications. Public API of the notifications module.

Other modules call `notify` when something happens that a person should know about; it joins
the caller's transaction, so the notification exists only if the change is committed.
Message bodies never carry health details or a patient's name: only a template, dates and
staff names. A user only ever sees and marks their own notifications.
"""

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.modules.identity_access.service import CurrentUser
from app.modules.notifications.models import Notification, Status, Template
from app.modules.notifications.schemas import NotificationInbox, NotificationOut

INBOX_LIMIT = 50


def notify(
    db: Session,
    recipient_ids: Iterable[uuid.UUID | None],
    template: Template,
    subject_id: uuid.UUID | None = None,
    params: dict[str, str] | None = None,
) -> None:
    """Add one notification per recipient to the caller's transaction. `None` is skipped: a
    patient without a login has no inbox."""
    for recipient_id in {r for r in recipient_ids if r is not None}:
        db.add(
            Notification(
                recipient_id=recipient_id,
                template=template,
                subject_id=subject_id,
                params=params or {},
            )
        )


def was_sent(
    db: Session, recipient_id: uuid.UUID, template: Template, subject_id: uuid.UUID
) -> bool:
    """So a reminder about the same appointment is sent once, however often reminders run."""
    query = select(Notification.id).where(
        Notification.recipient_id == recipient_id,
        Notification.template == template,
        Notification.subject_id == subject_id,
    )
    return db.scalar(query.limit(1)) is not None


def list_my_notifications(db: Session, user: CurrentUser) -> NotificationInbox:
    rows = db.scalars(
        select(Notification)
        .where(Notification.recipient_id == user.id)
        .order_by(Notification.sent_at.desc())
        .limit(INBOX_LIMIT)
    )
    unread = db.scalar(
        select(func.count()).where(
            Notification.recipient_id == user.id, Notification.status == Status.UNREAD
        )
    )
    return NotificationInbox(
        unread=unread or 0, items=[NotificationOut.model_validate(n) for n in rows]
    )


def mark_read(db: Session, user: CurrentUser, notification_id: uuid.UUID) -> NotificationOut:
    """Someone else's notification is reported as missing, so ids can't be probed."""
    notification = db.get(Notification, notification_id)
    if notification is None or notification.recipient_id != user.id:
        raise NotFoundError("Notification not found")
    if notification.status == Status.UNREAD:
        notification.status = Status.READ
        notification.read_at = datetime.now(UTC)
        db.commit()
    return NotificationOut.model_validate(notification)


def mark_all_read(db: Session, user: CurrentUser) -> None:
    db.execute(
        update(Notification)
        .where(Notification.recipient_id == user.id, Notification.status == Status.UNREAD)
        .values(status=Status.READ, read_at=datetime.now(UTC))
    )
    db.commit()
