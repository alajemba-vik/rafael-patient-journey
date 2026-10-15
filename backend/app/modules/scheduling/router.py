"""
Endpoints under /scheduling, e.g. GET /scheduling/appointments, POST
/scheduling/appointments/{id}/cancel.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/scheduling", tags=["scheduling"])
