import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _enum(cls: type[StrEnum], length: int) -> Enum:
    return Enum(
        cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e]
    )


class PathwayStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class MilestoneKind(StrEnum):
    INTAKE = "intake"
    REVIEW = "review"  # around 3 months
    FINAL = "final"  # around 6 months


class Goal(StrEnum):
    """What the patient wants from the pathway: up to three, from the Institute's list."""

    PAIN = "pain"
    TREATMENT_SIDE_EFFECTS = "treatment_side_effects"
    SELF_ESTEEM = "self_esteem"
    WEIGHT_LOSS = "weight_loss"
    WEIGHT_GAIN = "weight_gain"
    MUSCLE_STRENGTH = "muscle_strength"
    EMOTIONAL_SUPPORT = "emotional_support"
    SLEEP = "sleep"
    SEXUAL_HEALTH = "sexual_health"
    WELLBEING = "wellbeing"


# The disciplines a care plan can draw on, as listed in the Institute's assessment form.
DISCIPLINES = (
    "adapted_physical_activity", "acupuncture", "auriculotherapy", "chef_workshop",
    "universal_workshop", "art_therapy", "therapeutic_singing", "choir", "sports_coaching",
    "image_consulting", "healthy_cooking", "dance_therapy", "dietetics", "drama_therapy",
    "occupational_therapy", "writing_therapy", "femininity_sensuality", "support_group",
    "homeopathy", "hypnosis", "sensory_immersion", "physiotherapy", "luxopuncture", "massage",
    "neurofeedback_massage", "manicure", "nutrition_doctor", "sleep_medicine", "pain_medicine",
    "individual_meditation", "group_meditation", "micronutrition", "career_pathway",
    "music_therapy", "naturopathy", "neurofeedback", "oil_yoga", "osteopathy",
    "oncology_aesthetics", "pilates", "psychiatry", "psychology", "occupational_psychology",
    "psychomotor_therapy", "hair_prosthesis", "qi_gong", "reiki", "reflexology", "sexology",
    "sound_therapy", "sophrology", "sophro_sexology", "shiatsu", "therapeutic_touch", "tuina",
    "yoga",
)  # fmt: skip
MAX_GOALS = 3
MAX_DISCIPLINES = 5


class CarePathway(Base):
    """A patient's ~6-month pathway, led by a referent coordinator."""

    __tablename__ = "care_pathways"
    # The database itself refuses a second open pathway, even if two requests race.
    __table_args__ = (
        Index(
            "uq_care_pathways_one_open_per_patient",
            "patient_id",
            unique=True,
            postgresql_where=text("status = 'open'"),
            sqlite_where=text("status = 'open'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)  # id only: no cross-module FK
    coordinator_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    status: Mapped[PathwayStatus] = mapped_column(
        _enum(PathwayStatus, 8), default=PathwayStatus.OPEN
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PathwayMilestone(Base):
    """Intake, review or final review: the patient's self-assessment and the agreed plan."""

    __tablename__ = "pathway_milestones"
    __table_args__ = (UniqueConstraint("pathway_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Indexed through the unique constraint, which starts with it.
    pathway_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("care_pathways.id"))
    kind: Mapped[MilestoneKind] = mapped_column(_enum(MilestoneKind, 8))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_by: Mapped[uuid.UUID] = mapped_column(Uuid)

    # Self-assessment, 0 to 4, on the five dimensions the Institute uses.
    physical: Mapped[int] = mapped_column(SmallInteger)
    psychological: Mapped[int] = mapped_column(SmallInteger)
    emotional: Mapped[int] = mapped_column(SmallInteger)
    sexual: Mapped[int] = mapped_column(SmallInteger)
    socio_professional: Mapped[int] = mapped_column(SmallInteger)

    # [{"name": "Fatigue", "intensity": 7}, ...]
    symptoms: Mapped[list[dict]] = mapped_column(JSON, default=list)
    goals: Mapped[str] = mapped_column(Text, default="")
    plan: Mapped[str] = mapped_column(Text, default="")
    # The coordinator's own note: shown to the care team, not to the patient.
    note: Mapped[str] = mapped_column(Text, default="")
    # The care plan: Goal values and DISCIPLINES codes, in the order chosen.
    goal_codes: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    discipline_codes: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")


class PathwayNeed(Base):
    """A new need a practitioner flags to the referent coordinator, who adjusts the plan."""

    __tablename__ = "pathway_needs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    pathway_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("care_pathways.id"), index=True)
    raised_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str] = mapped_column(Text)
    # Open while these are empty.
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)


MESSAGE_MAX_LENGTH = 2000


class Message(Base):
    """One message in the conversation between a patient and their care team.

    A single thread per patient: the patient writes to their whole team, and any member of
    the team can read and answer.
    """

    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_patient_sent", "patient_id", "sent_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid)  # id only: no cross-module FK
    sender_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class AssessmentTest(StrEnum):
    """The scored tests of the assessment day (HDJ), each recorded by its practitioner."""

    K10 = "k10"  # psychological distress, 10 to 50
    MNA_SCREENING = "mna_screening"  # nutrition, 0 to 14
    MARSHALL = "marshall"  # physical activity, 0 to 8
    SITTING_HOURS = "sitting_hours"  # hours a day sitting or lying, sleep excluded
    BALANCE_RIGHT = "balance_right"  # seconds on the right foot, 30 at most
    BALANCE_LEFT = "balance_left"  # seconds on the left foot, 30 at most
    SIT_TO_STAND = "sit_to_stand"  # times standing up from a chair in 30 seconds
    HANDGRIP = "handgrip"  # grip strength, kg


class AssessmentScore(Base):
    """One test's result at one milestone of a pathway. Recorded again, it is replaced."""

    __tablename__ = "assessment_scores"
    __table_args__ = (
        UniqueConstraint("pathway_id", "kind", "test"),
        CheckConstraint("value >= 0", name="ck_assessment_scores_value_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    pathway_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("care_pathways.id"))
    kind: Mapped[MilestoneKind] = mapped_column(_enum(MilestoneKind, 8))
    test: Mapped[AssessmentTest] = mapped_column(_enum(AssessmentTest, 16))
    value: Mapped[float] = mapped_column(Float)
    recorded_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


TASK_TITLE_MAX_LENGTH = 120
TASK_NOTE_MAX_LENGTH = 1000


class Task(Base):
    """A piece of coordination work one staff member asks of another (or of themself):
    "book Mrs X's review", "call back about the nutrition workshop". It may be about a
    patient, and then only people who can see that patient can be involved."""

    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_assignee_status", "assigned_to", "status"),
        Index("ix_tasks_creator_status", "created_by", "status"),
        CheckConstraint("status IN ('todo', 'in_progress', 'done')", name="ck_tasks_status_valid"),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority_valid"),
        CheckConstraint(
            "(status = 'done') = (done_at IS NOT NULL)", name="ck_tasks_done_when_done_at"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(TASK_TITLE_MAX_LENGTH))
    note: Mapped[str | None] = mapped_column(String(TASK_NOTE_MAX_LENGTH))
    patient_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)  # no cross-module FK
    assigned_to: Mapped[uuid.UUID] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    priority: Mapped[TaskPriority] = mapped_column(
        _enum(TaskPriority, 8), default=TaskPriority.MEDIUM
    )
    status: Mapped[TaskStatus] = mapped_column(_enum(TaskStatus, 16), default=TaskStatus.TODO)
    due_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
