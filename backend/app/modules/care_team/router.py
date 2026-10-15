"""
Endpoints to assign or remove a professional/coordinator for a patient, and to flag a new need
to the coordinator.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/care-team", tags=["care_team"])
