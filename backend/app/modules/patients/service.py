"""Patient rules and permissions. Public API of the patients module.

Access policy (role + care relationship):
- patient       → own record, administrative + clinical
- professional,
  coordinator   → only patients in their care team, administrative + clinical
- secretary,
  admin         → every patient, administrative only
"""

import uuid

from sqlalchemy import select
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
    elif user.role in OFFICE_ROLES:
        view = PatientAdministrative.model_validate(patient)
    else:
        audit.record(db, user.id, "patient.read.denied", patient.id)
        db.commit()
        raise ForbiddenError("You are not allowed to see this patient")

    audit.record(db, user.id, "patient.read", patient.id)
    db.commit()
    return view


def list_patients(db: Session, user: CurrentUser) -> list[PatientAdministrative]:
    query = select(Patient).order_by(Patient.last_name, Patient.first_name)
    if user.role in CARE_ROLES:
        query = query.where(Patient.id.in_(care_team.patient_ids_for(db, user.id)))
    elif user.role not in OFFICE_ROLES:
        raise ForbiddenError("You are not allowed to list patients")
    return [PatientAdministrative.model_validate(p) for p in db.scalars(query)]


def _check_account_can_be_linked(db: Session, user_id: uuid.UUID) -> None:
    if not identity.is_patient_account(db, user_id):
        raise NotFoundError("No patient account with this id")
    if db.scalar(select(Patient.id).where(Patient.user_id == user_id)) is not None:
        raise ConflictError("This account is already linked to a patient")


def _can_see_clinical(db: Session, user: CurrentUser, patient: Patient) -> bool:
    if user.role == Role.PATIENT:
        return patient.user_id == user.id
    if user.role in CARE_ROLES:
        return care_team.is_in_care_team(db, user.id, patient.id)
    return False
