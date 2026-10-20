"""Patient rules and permissions. Public API of the patients module.

Access policy (role + care relationship):
- patient      → own record, administrative + clinical
- professional → only patients in their care team, administrative + clinical
- coordinator  → patients in their care team, administrative + clinical; every other patient,
                 administrative only, so they can take on new patients
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
from app.modules.patients.schemas import PatientAdministrative, PatientCreate, PatientDetail

CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
OFFICE_ROLES = {Role.SECRETARY, Role.ADMIN}
# TODO(validate): may coordinators see every patient's administrative record, as the
# coordination unit contacting new patients suggests? (V-06, V-07)
ADMINISTRATIVE_ROLES = OFFICE_ROLES | {Role.COORDINATOR}
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


def get_patient(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> PatientDetail | PatientAdministrative:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")

    if _can_see_clinical(db, user, patient):
        view = PatientDetail.model_validate(patient)
    elif user.role in ADMINISTRATIVE_ROLES:
        view = PatientAdministrative.model_validate(patient)
    else:
        audit.record(db, user.id, "patient.read.denied", patient.id)
        db.commit()
        raise ForbiddenError("You are not allowed to see this patient")

    audit.record(db, user.id, "patient.read", patient.id)
    db.commit()
    return view


def list_patients(
    db: Session, user: CurrentUser, search: str | None = None, mine: bool = False
) -> list[PatientAdministrative]:
    """Alphabetical, at most LIST_LIMIT rows.

    `search` matches the start of a first or last name; `mine` keeps a coordinator's own care
    team (a practitioner only ever sees theirs).
    """
    query = select(Patient).order_by(Patient.last_name, Patient.first_name).limit(LIST_LIMIT)
    if user.role == Role.PROFESSIONAL or (user.role == Role.COORDINATOR and mine):
        query = query.where(Patient.id.in_(care_team.patient_ids_for(db, user.id)))
    elif user.role not in ADMINISTRATIVE_ROLES:
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


def _can_see_clinical(db: Session, user: CurrentUser, patient: Patient) -> bool:
    if user.role == Role.PATIENT:
        return patient.user_id == user.id
    if user.role in CARE_ROLES:
        return care_team.is_in_care_team(db, user.id, patient.id)
    return False
