"""Public API of care_team. Other modules ask here whether someone is part of a patient's care."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.care_team.models import CareAssignment


def is_in_care_team(db: Session, professional_id: uuid.UUID, patient_id: uuid.UUID) -> bool:
    query = select(CareAssignment.id).where(
        CareAssignment.professional_id == professional_id,
        CareAssignment.patient_id == patient_id,
    )
    return db.scalar(query) is not None


def patient_ids_for(db: Session, professional_id: uuid.UUID) -> list[uuid.UUID]:
    query = select(CareAssignment.patient_id).where(
        CareAssignment.professional_id == professional_id
    )
    return list(db.scalars(query))
