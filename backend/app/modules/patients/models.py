import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint("birth_date >= '1900-01-01'", name="ck_patients_birth_date_after_1900"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # The patient's own login account, if they have one.
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)

    # Administrative data: visible to reception and admins.
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32))

    # Clinical data: only the patient and their care team.
    medical_summary: Mapped[str | None] = mapped_column(Text)


class CancerSite(StrEnum):
    """Where the cancer is, as listed in the Institute's pathway questionnaire."""

    BREAST = "breast"
    PROSTATE = "prostate"
    BRAIN = "brain"
    HEAD_NECK = "head_neck"
    SINUS = "sinus"
    THYROID = "thyroid"
    LUNG = "lung"
    OESOPHAGUS = "oesophagus"
    STOMACH = "stomach"
    LIVER = "liver"
    GALLBLADDER = "gallbladder"
    PANCREAS = "pancreas"
    KIDNEY = "kidney"
    COLORECTAL = "colorectal"
    UROTHELIAL = "urothelial"
    ANAL = "anal"
    OVARY = "ovary"
    ENDOMETRIUM = "endometrium"
    CERVIX = "cervix"
    VAGINA = "vagina"
    VULVA = "vulva"
    TESTIS = "testis"
    SKIN = "skin"
    LYMPH_NODE = "lymph_node"
    BLOOD = "blood"
    OTHER = "other"


class WorkSituation(StrEnum):
    ACTIVE = "active"
    RETIRED = "retired"
    SICK_LEAVE = "sick_leave"
    THERAPEUTIC_PART_TIME = "therapeutic_part_time"
    OTHER = "other"


class TreatmentKind(StrEnum):
    SURGERY = "surgery"
    CHEMOTHERAPY = "chemotherapy"
    RADIOTHERAPY = "radiotherapy"
    HORMONE_THERAPY = "hormone_therapy"
    IMMUNOTHERAPY = "immunotherapy"
    TARGETED_THERAPY = "targeted_therapy"
    OTHER = "other"


class TreatmentStatus(StrEnum):
    ONGOING = "ongoing"
    FINISHED = "finished"


def _values(enum: type[StrEnum]) -> list[str]:
    return [member.value for member in enum]


NOTE_MAX_LENGTH = 1000
TEXT_MAX_LENGTH = 255
MAX_TREATMENTS = 20


class ClinicalProfile(Base):
    """The structured part of the patient's file: disease, body, social life and habits.

    One per patient, filled in by the care team (usually at intake). Clinical data: only the
    patient and their care team may read it.
    """

    __tablename__ = "clinical_profiles"
    __table_args__ = (
        CheckConstraint(
            "height_cm IS NULL OR height_cm BETWEEN 50 AND 250",
            name="ck_clinical_profiles_height_range",
        ),
        CheckConstraint(
            "weight_kg IS NULL OR weight_kg BETWEEN 20 AND 350",
            name="ck_clinical_profiles_weight_range",
        ),
        CheckConstraint(
            "drinks_per_week IS NULL OR drinks_per_week BETWEEN 0 AND 200",
            name="ck_clinical_profiles_drinks_range",
        ),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), primary_key=True)

    cancer_site: Mapped[CancerSite | None] = mapped_column(
        Enum(CancerSite, native_enum=False, length=32, values_callable=_values)
    )
    diagnosed_on: Mapped[date | None] = mapped_column(Date)
    metastatic: Mapped[bool | None] = mapped_column(Boolean)

    height_cm: Mapped[int | None] = mapped_column(SmallInteger)
    weight_kg: Mapped[int | None] = mapped_column(SmallInteger)
    allergies: Mapped[str | None] = mapped_column(String(TEXT_MAX_LENGTH))

    occupation: Mapped[str | None] = mapped_column(String(TEXT_MAX_LENGTH))
    work_situation: Mapped[WorkSituation | None] = mapped_column(
        Enum(WorkSituation, native_enum=False, length=32, values_callable=_values)
    )
    lives_alone: Mapped[bool | None] = mapped_column(Boolean)
    has_dependants: Mapped[bool | None] = mapped_column(Boolean)
    has_caregivers: Mapped[bool | None] = mapped_column(Boolean)
    caregivers: Mapped[str | None] = mapped_column(String(TEXT_MAX_LENGTH))

    smoker: Mapped[bool | None] = mapped_column(Boolean)
    drinks_alcohol: Mapped[bool | None] = mapped_column(Boolean)
    drinks_per_week: Mapped[int | None] = mapped_column(SmallInteger)
    takes_supplements: Mapped[bool | None] = mapped_column(Boolean)

    notes: Mapped[str | None] = mapped_column(String(NOTE_MAX_LENGTH))

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[uuid.UUID] = mapped_column(Uuid)  # id only: no cross-module FK


class Treatment(Base):
    """A cancer treatment the patient had or is having, with its dates."""

    __tablename__ = "treatments"
    __table_args__ = (
        CheckConstraint(
            "ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on",
            name="ck_treatments_ends_after_start",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    kind: Mapped[TreatmentKind] = mapped_column(
        Enum(TreatmentKind, native_enum=False, length=32, values_callable=_values)
    )
    status: Mapped[TreatmentStatus] = mapped_column(
        Enum(TreatmentStatus, native_enum=False, length=16, values_callable=_values)
    )
    started_on: Mapped[date | None] = mapped_column(Date)
    ended_on: Mapped[date | None] = mapped_column(Date)
    # Molecule, protocol, number of sessions…
    details: Mapped[str | None] = mapped_column(String(TEXT_MAX_LENGTH))
