"""Endpoints such as GET /reception/today and POST /reception/{appointment_id}/check-in."""

from fastapi import APIRouter

router = APIRouter(prefix="/reception", tags=["reception"])
