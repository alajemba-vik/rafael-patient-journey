"""Public API of care_team. Other modules ask here whether someone is part of a patient's care.

Access policy:
- coordinator, admin → add or remove anyone in any patient's team, and see any team
- professional       → see the team of patients they are part of
- secretary          → see any team (names and roles), to book appointments with its members
- patient            → no access here
"""

import uuid
from datetime import UTC, datetime
from typing import NoReturn

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team.models import CareAssignment
from app.modules.care_team.schemas import AssignmentCreate, AssignmentOut, CareTeamMember
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.notifications import service as notifications
from app.modules.notifications.models import Template

# Coordinators (and admins) record who is in a patient's care team, for any patient.
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


def member_ids(db: Session, patient_id: uuid.UUID) -> list[uuid.UUID]:
    """For other modules: everyone in a patient's care team. Callers check access."""
    query = select(CareAssignment.professional_id).where(CareAssignment.patient_id == patient_id)
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

    assignment = CareAssignment(**data.model_dump(), added_by=user.id, added_at=datetime.now(UTC))
    db.add(assignment)
    db.flush()
    audit.record(db, user.id, "care_team.assign", data.patient_id)
    if data.professional_id != user.id:
        # The reason goes along (no medical content); the patient is the subject, for the link.
        notifications.notify(
            db,
            [data.professional_id],
            Template.FILE_SHARED,
            subject_id=data.patient_id,
            params={"reason": data.reason.value},
        )
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
    # Reception sees the team too: booking means choosing one of its members.
    allowed = user.role in MANAGER_ROLES | {Role.SECRETARY} or (
        user.role == Role.PROFESSIONAL and is_in_care_team(db, user.id, patient_id)
    )
    if not allowed:
        _deny(db, user, "care_team.read.denied", patient_id)

    assignments = db.scalars(select(CareAssignment).where(CareAssignment.patient_id == patient_id))
    assignment_by_member = {a.professional_id: a for a in assignments}
    # Skip the names query when the team is empty: one database round trip less.
    people = set(assignment_by_member) | {
        a.added_by for a in assignment_by_member.values() if a.added_by
    }
    accounts = {u.id: u for u in identity.get_users(db, list(people))} if people else {}
    members = [
        CareTeamMember(
            assignment_id=assignment.id,
            user_id=member_id,
            full_name=accounts[member_id].full_name,
            role=accounts[member_id].role,
            discipline=accounts[member_id].discipline,
            reason=assignment.reason,
            note=assignment.note,
            added_by_name=accounts[assignment.added_by].full_name
            if assignment.added_by in accounts
            else None,
            added_at=assignment.added_at,
        )
        for member_id, assignment in assignment_by_member.items()
        if member_id in accounts
    ]
    members.sort(key=lambda m: m.full_name)
    audit.record(db, user.id, "care_team.read", patient_id)
    db.commit()
    return members


def _deny(db: Session, user: CurrentUser, action: str, patient_id: uuid.UUID) -> NoReturn:
    audit.record(db, user.id, action, patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to manage or see this care team")
