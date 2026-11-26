"""Endpoints under /notifications: a user's own inbox."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access.service import CurrentUser, get_current_user
from app.modules.notifications import service
from app.modules.notifications.schemas import NotificationInbox, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_my_notifications(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> NotificationInbox:
    return service.list_my_notifications(db, user)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    service.mark_all_read(db, user)


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    return service.mark_read(db, user, notification_id)
