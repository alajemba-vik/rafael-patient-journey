"""Endpoints under /notifications (e.g. a user's own notification history)."""

from fastapi import APIRouter

router = APIRouter(prefix="/notifications", tags=["notifications"])
