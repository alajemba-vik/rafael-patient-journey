"""Patient rules and permissions. Public API of the patients module.

Access policy (role + care relationship):
- patient      → own record, administrative + clinical
- professional → only patients in their care team, administrative + clinical
- coordinator  → patients in their care team, administrative + clinical; patients with no
                 coordinator yet ("unassigned"), administrative only, so they can take them on
- secretary,
  admin        → every patient, administrative only
"""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients.models import Patient
from app.modules.patients.schemas import (
    PatientAdministrative,
    PatientCreate,
    PatientDetail,
    PatientUpdate,
)

CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
OFFICE_ROLES = {Role.SECRETARY, Role.ADMIN}
# TODO(validate): how are new patients given a coordinator, and what may coordinators see
# before that? For now they see unassigned patients' administrative data. (V-06, V-07)
LIST_LIMIT = 100


def create_patient(db: Session, user: CurrentUser, data: PatientCreate) -> PatientAdministrative:
    if user.role not in OFFICE_ROLES:
        raise ForbiddenError("Only reception or admins can register patients")
    if data.user_id is not None:
        _check_account_can_be_linked(db, data.user_id)
    patient = Patient(**data.model_dump())
    db.add(patient)
    db.flush()
    audit.record(db, user.id, "patient.create", patient.id)
    db.commit()
    return PatientAdministrative.model_validate(patient)


def update_patient(
    db: Session, user: CurrentUser, patient_id: uuid.UUID, data: PatientUpdate
) -> PatientAdministrative:
    """Reception and admins update contact details or link the patient's login."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")
    if user.role not in OFFICE_ROLES:
        audit.record(db, user.id, "patient.update.denied", patient.id)
        db.commit()
        raise ForbiddenError("Only reception or admins can update patients")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("user_id") is not None and changes["user_id"] != patient.user_id:
        _check_account_can_be_linked(db, changes["user_id"])

    for field, value in changes.items():
        setattr(patient, field, value)
    audit.record(db, user.id, "patient.update", patient.id)
    db.commit()
    return PatientAdministrative.model_validate(patient)


def get_patient(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> PatientDetail | PatientAdministrative:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")

    if _can_see_clinical(db, user, patient):
        view = PatientDetail.model_validate(patient)
    elif user.role in OFFICE_ROLES or _is_unassigned_for_coordinator(db, user, patient.id):
        view = PatientAdministrative.model_validate(patient)
    else:
        audit.record(db, user.id, "patient.read.denied", patient.id)
        db.commit()
        raise ForbiddenError("You are not allowed to see this patient")

    audit.record(db, user.id, "patient.read", patient.id)
    db.commit()
    return view


def list_patients(
    db: Session, user: CurrentUser, search: str | None = None, unassigned: bool = False
) -> list[PatientAdministrative]:
    """Alphabetical, at most LIST_LIMIT rows.

    Practitioners and coordinators get their own care-team patients; with `unassigned`, a
    coordinator gets the patients nobody coordinates yet. `search` matches the start of a
    first or last name.
    """
    query = select(Patient).order_by(Patient.last_name, Patient.first_name).limit(LIST_LIMIT)
    if user.role == Role.COORDINATOR and unassigned:
        query = query.where(Patient.id.not_in(care_team.coordinated_patient_ids(db)))
    elif user.role in CARE_ROLES:
        query = query.where(Patient.id.in_(care_team.patient_ids_for(db, user.id)))
    elif user.role not in OFFICE_ROLES:
        raise ForbiddenError("You are not allowed to list patients")
    if search:
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"{escaped}%"
        query = query.where(
            or_(
                Patient.last_name.ilike(pattern, escape="\\"),
                Patient.first_name.ilike(pattern, escape="\\"),
            )
        )

    patients = list(db.scalars(query))
    audit.record_many(db, user.id, "patient.list", {p.id for p in patients})
    db.commit()
    return [PatientAdministrative.model_validate(p) for p in patients]


def get_names(db: Session, patient_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Display names for other modules' lists. The calling module checks access and audits."""
    if not patient_ids:
        return {}
    rows = db.execute(
        select(Patient.id, Patient.first_name, Patient.last_name).where(Patient.id.in_(patient_ids))
    )
    return {row.id: f"{row.first_name} {row.last_name}" for row in rows}


def get_patient_id_for_user(db: Session, user_id: uuid.UUID) -> uuid.UUID | None:
    """The patient record behind a patient's login, if any."""
    return db.scalar(select(Patient.id).where(Patient.user_id == user_id))


def _check_account_can_be_linked(db: Session, user_id: uuid.UUID) -> None:
    if identity.get_role(db, user_id) != Role.PATIENT:
        raise NotFoundError("No patient account with this id")
    if db.scalar(select(Patient.id).where(Patient.user_id == user_id)) is not None:
        raise ConflictError("This account is already linked to a patient")


def _is_unassigned_for_coordinator(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> bool:
    return user.role == Role.COORDINATOR and patient_id not in care_team.coordinated_patient_ids(db)


def _can_see_clinical(db: Session, user: CurrentUser, patient: Patient) -> bool:
    if user.role == Role.PATIENT:
        return patient.user_id == user.id
    if user.role in CARE_ROLES:
        return care_team.is_in_care_team(db, user.id, patient.id)
    return False
