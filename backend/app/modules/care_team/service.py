"""Public API of care_team. Other modules ask here whether someone is part of a patient's care.

Access policy:
- coordinator, admin → add or remove anyone in any patient's team, and see any team
- professional       → see the team of patients they are part of
- secretary          → see any team (names and roles), to book appointments with its members
- patient            → no access here
"""

import uuid
from typing import NoReturn

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team.models import CareAssignment
from app.modules.care_team.schemas import AssignmentCreate, AssignmentOut, CareTeamMember
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role

# TODO(validate): who records the care team in the system: coordinators only, or reception
# too? And may any coordinator change any patient's team, or only their referent? (V-03, V-16)
MANAGER_ROLES = {Role.COORDINATOR, Role.ADMIN}
CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}


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


def coordinated_patient_ids(db: Session) -> set[uuid.UUID]:
    """For other modules: patients who already have a coordinator in their care team."""
    coordinator_ids = identity.list_ids_with_role(db, Role.COORDINATOR)
    if not coordinator_ids:
        return set()
    query = select(CareAssignment.patient_id).where(
        CareAssignment.professional_id.in_(coordinator_ids)
    )
    return set(db.scalars(query))


def create_assignment(db: Session, user: CurrentUser, data: AssignmentCreate) -> AssignmentOut:
    """Add a professional or coordinator to a patient's care team.

    The patient id isn't checked against the patients module: patients already depends on
    care_team, and an assignment to an unknown id grants access to nothing.
    """
    if user.role not in MANAGER_ROLES:
        _deny(db, user, "care_team.assign.denied", data.patient_id)
    if identity.get_role(db, data.professional_id) not in CARE_ROLES:
        raise NotFoundError("No professional or coordinator account with this id")
    if is_in_care_team(db, data.professional_id, data.patient_id):
        raise ConflictError("Already in this patient's care team")

    assignment = CareAssignment(patient_id=data.patient_id, professional_id=data.professional_id)
    db.add(assignment)
    db.flush()
    audit.record(db, user.id, "care_team.assign", data.patient_id)
    db.commit()
    return AssignmentOut.model_validate(assignment)


def delete_assignment(db: Session, user: CurrentUser, assignment_id: uuid.UUID) -> None:
    assignment = db.get(CareAssignment, assignment_id)
    if assignment is None:
        raise NotFoundError("Assignment not found")
    if user.role not in MANAGER_ROLES:
        _deny(db, user, "care_team.remove.denied", assignment.patient_id)

    db.delete(assignment)
    audit.record(db, user.id, "care_team.remove", assignment.patient_id)
    db.commit()


def list_members(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> list[CareTeamMember]:
    # TODO(validate): may reception see who is in a patient's care team? Needed to book. (V-07)
    allowed = user.role in MANAGER_ROLES | {Role.SECRETARY} or (
        user.role == Role.PROFESSIONAL and is_in_care_team(db, user.id, patient_id)
    )
    if not allowed:
        _deny(db, user, "care_team.read.denied", patient_id)

    assignments = db.scalars(select(CareAssignment).where(CareAssignment.patient_id == patient_id))
    assignment_by_member = {a.professional_id: a.id for a in assignments}
    # Skip the names query when the team is empty: one database round trip less.
    accounts = identity.get_users(db, list(assignment_by_member)) if assignment_by_member else []
    members = [
        CareTeamMember(
            assignment_id=assignment_by_member[account.id],
            user_id=account.id,
            full_name=account.full_name,
            role=account.role,
            discipline=account.discipline,
        )
        for account in accounts
    ]
    audit.record(db, user.id, "care_team.read", patient_id)
    db.commit()
    return members


def _deny(db: Session, user: CurrentUser, action: str, patient_id: uuid.UUID) -> NoReturn:
    audit.record(db, user.id, action, patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to manage or see this care team")
