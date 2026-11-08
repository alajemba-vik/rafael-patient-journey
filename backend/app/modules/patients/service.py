"""Patient rules and permissions. Public API of the patients module.

Access policy (role + care relationship):
- patient      → own record, administrative + clinical
- professional → only patients in their care team, administrative + clinical
- coordinator  → patients in their care team, administrative + clinical; patients with no
                 coordinator yet ("unassigned"), administrative only, so they can take them on
- secretary,
  admin        → every patient, administrative only
"""

import unicodedata
import uuid

from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.patients.models import Patient
from app.modules.patients.schemas import (
    FRANCE_CODE,
    PatientAdministrative,
    PatientCreate,
    PatientDetail,
    PatientUpdate,
)

CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
OFFICE_ROLES = {Role.SECRETARY, Role.ADMIN}
# Coordinators also see the administrative data of patients who have no coordinator yet,
# so one of them can take the patient on.
LIST_LIMIT = 100
PHONE_SEARCH_DIGITS = 3
# Sent as null, these are cleared: no email, no phone, or the login unlinked.
CLEARABLE_FIELDS = {"email", "phone", "user_id"}


def create_patient(db: Session, user: CurrentUser, data: PatientCreate) -> PatientAdministrative:
    if user.role not in OFFICE_ROLES:
        raise ForbiddenError("Only reception or admins can register patients")
    if data.user_id is not None:
        _check_account_can_be_linked(db, data.user_id)
    if not data.allow_duplicate and _has_namesake(db, data):
        raise ConflictError("A patient with this name and birth date is already registered")
    patient = Patient(**data.model_dump(exclude={"allow_duplicate"}))
    db.add(patient)
    db.flush()
    audit.record(db, user.id, "patient.create", patient.id)
    db.commit()
    return PatientAdministrative.model_validate(patient)


def update_patient(
    db: Session, user: CurrentUser, patient_id: uuid.UUID, data: PatientUpdate
) -> PatientAdministrative:
    """Reception and admins correct the record, update contact details or link the login."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")
    if user.role not in OFFICE_ROLES:
        audit.record(db, user.id, "patient.update.denied", patient.id)
        db.commit()
        raise ForbiddenError("Only reception or admins can update patients")
    # A field sent as null clears it, except names and birth date, which every patient has.
    changes = {
        field: value
        for field, value in data.model_dump(exclude_unset=True).items()
        if value is not None or field in CLEARABLE_FIELDS
    }
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
    first or last name, or, when it is a number, part of the phone number: reception
    finds who is calling.
    """
    query = select(Patient).order_by(Patient.last_name, Patient.first_name).limit(LIST_LIMIT)
    if user.role == Role.COORDINATOR and unassigned:
        query = query.where(Patient.id.not_in(care_team.coordinated_patient_ids(db)))
    elif user.role in CARE_ROLES:
        query = query.where(Patient.id.in_(care_team.patient_ids_for(db, user.id)))
    elif user.role not in OFFICE_ROLES:
        raise ForbiddenError("You are not allowed to list patients")
    if search and search.strip():
        query = query.where(_matches(search.strip()))

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


def patient_exists(db: Session, patient_id: uuid.UUID) -> bool:
    """For other modules that take a patient id: make sure it points to a real record."""
    return db.scalar(select(Patient.id).where(Patient.id == patient_id)) is not None


def get_patient_id_for_user(db: Session, user_id: uuid.UUID) -> uuid.UUID | None:
    """The patient record behind a patient's login, if any."""
    return db.scalar(select(Patient.id).where(Patient.user_id == user_id))


def _matches(search: str) -> ColumnElement[bool]:
    """A name prefix, or a run of at least PHONE_SEARCH_DIGITS digits anywhere in the phone."""
    digits = "".join(ch for ch in search if ch.isdigit())
    if len(digits) >= PHONE_SEARCH_DIGITS and not any(ch.isalpha() for ch in search):
        return Patient.phone.contains(_stored_phone_digits(search, digits), autoescape=True)
    pattern = _escape_like(search) + "%"
    return or_(
        Patient.last_name.ilike(pattern, escape="\\"),
        Patient.first_name.ilike(pattern, escape="\\"),
    )


def _stored_phone_digits(search: str, digits: str) -> str:
    """The digits as they are stored: "+33 6 12" is searched as "0612", like the number."""
    international = search.strip().startswith("+") or digits.startswith("00")
    national = digits.removeprefix("00") if international else digits
    if international and national.startswith(FRANCE_CODE) and len(national) > len(FRANCE_CODE):
        return "0" + national[len(FRANCE_CODE) :]
    return national


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _has_namesake(db: Session, data: PatientCreate) -> bool:
    """Same first name, last name and birth date: most likely the same person registered twice.

    Compared without case or accents ("Elodie" is "Élodie"), in Python: the few people born
    that day are fetched, so no database-specific accent function is needed.
    """
    wanted = (_fold(data.first_name), _fold(data.last_name))
    rows = db.execute(
        select(Patient.first_name, Patient.last_name).where(Patient.birth_date == data.birth_date)
    )
    return any((_fold(first), _fold(last)) == wanted for first, last in rows)


def _fold(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name.strip())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).casefold()


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
