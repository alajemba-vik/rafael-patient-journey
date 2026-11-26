"""Shapes for a user's own notifications."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.notifications.models import Status, Template


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template: Template
    subject_id: uuid.UUID | None
    params: dict[str, str]
    status: Status
    sent_at: datetime
    read_at: datetime | None


class NotificationInbox(BaseModel):
    unread: int
    items: list[NotificationOut]
