"""Read-only endpoints under /analytics."""

from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])
