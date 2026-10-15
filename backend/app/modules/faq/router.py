"""Endpoints under /faq (public GET, admin-only write)."""

from fastapi import APIRouter

router = APIRouter(prefix="/faq", tags=["faq"])
