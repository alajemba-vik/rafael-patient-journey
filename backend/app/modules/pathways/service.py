"""The ~6-month care pathway: opened by a coordinator, with intake, review and final review.

Access policy:
- coordinator in the patient's care team → open and close the pathway, record milestones,
                                           resolve flagged needs
- professional or coordinator in the team → read the patient's pathways, notes included, and
                                           flag a new need to the referent coordinator
- patient                                → their own pathways, without the coordinator's notes
- secretary, admin                       → no access (clinical data)
"""

import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import NoReturn

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, aliased

from app import audit
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.care_team import service as care_team
from app.modules.identity_access import service as identity
from app.modules.identity_access.service import CurrentUser, Role
from app.modules.pathways.models import (
    CarePathway,
    MilestoneKind,
    PathwayMilestone,
    PathwayNeed,
    PathwayStatus,
)
from app.modules.pathways.schemas import (
    Milestone,
    MilestoneCreate,
    NeedCreate,
    NeedOut,
    PathwayOpen,
    PathwayOut,
    PathwaySummary,
    PatientMilestone,
    PatientPathway,
)
from app.modules.patients import service as patients

# TODO(validate): may a patient follow a second pathway, or change coordinator? (V-16)
# Do chronic-disease patients and caregivers follow the same pathway? (V-10)
CARE_ROLES = {Role.PROFESSIONAL, Role.COORDINATOR}
# TODO(validate): may every practitioner in the team see every score, including the
# sexual-health dimension? (V-07)
MILESTONE_ORDER = [MilestoneKind.INTAKE, MilestoneKind.REVIEW, MilestoneKind.FINAL]
DIMENSIONS = ("physical", "psychological", "emotional", "sexual", "socio_professional")
# As published by the Institute: a review around 3 months and a final review around 6.
DUE_AFTER_OPENING = {
    MilestoneKind.INTAKE: timedelta(0),
    MilestoneKind.REVIEW: timedelta(days=91),
    MilestoneKind.FINAL: timedelta(days=182),
}


def open_pathway(db: Session, user: CurrentUser, data: PathwayOpen) -> PathwayOut:
    """The coordinator who opens the pathway becomes the patient's referent."""
    if not _is_team_coordinator(db, user, data.patient_id):
        _deny(db, user, "pathway.open.denied", data.patient_id)
    open_query = select(CarePathway.id).where(
        CarePathway.patient_id == data.patient_id, CarePathway.status == PathwayStatus.OPEN
    )
    if db.scalar(open_query) is not None:
        raise ConflictError("This patient already has an open pathway")

    pathway = CarePathway(
        patient_id=data.patient_id, coordinator_id=user.id, opened_at=datetime.now(UTC)
    )
    db.add(pathway)
    audit.record(db, user.id, "pathway.open", data.patient_id)
    db.commit()
    return _to_out(db, [pathway])[0]


def record_milestone(
    db: Session, user: CurrentUser, pathway_id: uuid.UUID, data: MilestoneCreate
) -> PathwayOut:
    pathway = _get(db, pathway_id)
    if not _is_team_coordinator(db, user, pathway.patient_id):
        _deny(db, user, "pathway.milestone.denied", pathway.patient_id)
    if pathway.status != PathwayStatus.OPEN:
        raise ConflictError("This pathway is closed")
    recorded = {m.kind for m in _milestones_by_pathway(db, [pathway.id])[pathway.id]}
    if data.kind in recorded:
        raise ConflictError("This milestone is already recorded")
    if data.kind != MilestoneKind.INTAKE and MilestoneKind.INTAKE not in recorded:
        raise ConflictError("Record the intake first")

    milestone = PathwayMilestone(
        pathway_id=pathway.id,
        recorded_at=datetime.now(UTC),
        recorded_by=user.id,
        **data.model_dump(),
    )
    db.add(milestone)
    audit.record(db, user.id, f"pathway.{data.kind.value}", pathway.patient_id)
    db.commit()
    return _to_out(db, [pathway])[0]


def close_pathway(db: Session, user: CurrentUser, pathway_id: uuid.UUID) -> PathwayOut:
    pathway = _get(db, pathway_id)
    if not _is_team_coordinator(db, user, pathway.patient_id):
        _deny(db, user, "pathway.close.denied", pathway.patient_id)
    if pathway.status == PathwayStatus.CLOSED:
        raise ConflictError("This pathway is already closed")

    pathway.status = PathwayStatus.CLOSED
    pathway.closed_at = datetime.now(UTC)
    audit.record(db, user.id, "pathway.close", pathway.patient_id)
    db.commit()
    return _to_out(db, [pathway])[0]


def list_patient_pathways(
    db: Session, user: CurrentUser, patient_id: uuid.UUID
) -> list[PathwayOut]:
    """Newest first. For the patient's care team."""
    if user.role not in CARE_ROLES or not care_team.is_in_care_team(db, user.id, patient_id):
        _deny(db, user, "pathway.read.denied", patient_id)

    pathways = _pathways_of(db, patient_id)
    audit.record(db, user.id, "pathway.read", patient_id)
    db.commit()
    return _to_out(db, pathways)


def list_my_pathways(db: Session, user: CurrentUser) -> list[PatientPathway]:
    """A patient's own pathways, newest first, without the coordinator's notes."""
    if user.role != Role.PATIENT:
        raise ForbiddenError("Only patients have their own pathway")
    patient_id = patients.get_patient_id_for_user(db, user.id)
    if patient_id is None:
        return []

    pathways = _to_out(db, _pathways_of(db, patient_id))
    audit.record(db, user.id, "pathway.read", patient_id)
    db.commit()
    return [
        PatientPathway(
            **p.model_dump(include={"id", "coordinator_name", "status", "opened_at", "closed_at"}),
            milestones=[PatientMilestone.model_validate(m.model_dump()) for m in p.milestones],
        )
        for p in pathways
    ]


def list_led_pathways(db: Session, user: CurrentUser) -> list[PathwaySummary]:
    """The open pathways a coordinator leads, with the next milestone and when it's due."""
    if user.role != Role.COORDINATOR:
        raise ForbiddenError("Only coordinators lead pathways")

    query = select(CarePathway).where(
        CarePathway.coordinator_id == user.id, CarePathway.status == PathwayStatus.OPEN
    )
    pathways = list(db.scalars(query.order_by(CarePathway.opened_at)))
    milestones = _milestones_by_pathway(db, [p.id for p in pathways])
    names = patients.get_names(db, {p.patient_id for p in pathways})
    audit.record_many(db, user.id, "pathway.list", {p.patient_id for p in pathways})
    db.commit()
    return [_summary(p, milestones[p.id], names.get(p.patient_id, "")) for p in pathways]


def raise_need(db: Session, user: CurrentUser, pathway_id: uuid.UUID, data: NeedCreate) -> NeedOut:
    """A practitioner in the team tells the referent coordinator about a new need."""
    pathway = _get(db, pathway_id)
    if user.role not in CARE_ROLES or not care_team.is_in_care_team(
        db, user.id, pathway.patient_id
    ):
        _deny(db, user, "pathway.need.denied", pathway.patient_id)
    if pathway.status != PathwayStatus.OPEN:
        raise ConflictError("This pathway is closed")

    need = PathwayNeed(
        pathway_id=pathway.id, raised_by=user.id, raised_at=datetime.now(UTC), note=data.note
    )
    db.add(need)
    audit.record(db, user.id, "pathway.need", pathway.patient_id)
    db.commit()
    return _needs_out(db, [(need, pathway)])[0]


def list_open_needs(db: Session, user: CurrentUser) -> list[NeedOut]:
    """A coordinator's inbox: unresolved needs on the pathways they lead, oldest first."""
    if user.role != Role.COORDINATOR:
        raise ForbiddenError("Only coordinators receive flagged needs")

    query = (
        select(PathwayNeed, CarePathway)
        .join(CarePathway, PathwayNeed.pathway_id == CarePathway.id)
        .where(CarePathway.coordinator_id == user.id, PathwayNeed.resolved_at.is_(None))
        .order_by(PathwayNeed.raised_at)
    )
    rows = [(need, pathway) for need, pathway in db.execute(query)]
    audit.record_many(db, user.id, "pathway.need.list", {p.patient_id for _, p in rows})
    db.commit()
    return _needs_out(db, rows)


def resolve_need(db: Session, user: CurrentUser, need_id: uuid.UUID) -> NeedOut:
    need = db.get(PathwayNeed, need_id)
    if need is None:
        raise NotFoundError("Need not found")
    pathway = _get(db, need.pathway_id)
    if not _is_team_coordinator(db, user, pathway.patient_id):
        _deny(db, user, "pathway.need.resolve.denied", pathway.patient_id)
    if need.resolved_at is not None:
        raise ConflictError("This need is already resolved")

    need.resolved_at = datetime.now(UTC)
    need.resolved_by = user.id
    audit.record(db, user.id, "pathway.need.resolve", pathway.patient_id)
    db.commit()
    return _needs_out(db, [(need, pathway)])[0]


def _needs_out(db: Session, rows: list[tuple[PathwayNeed, CarePathway]]) -> list[NeedOut]:
    """Add patient and practitioner names with two queries in total."""
    patient_names = patients.get_names(db, {p.patient_id for _, p in rows})
    staff_ids = list({n.raised_by for n, _ in rows})
    staff_names = {u.id: u.full_name for u in identity.get_users(db, staff_ids)} if rows else {}
    return [
        NeedOut(
            id=need.id,
            pathway_id=pathway.id,
            patient_id=pathway.patient_id,
            patient_name=patient_names.get(pathway.patient_id, ""),
            raised_by_name=staff_names.get(need.raised_by, ""),
            raised_at=need.raised_at,
            note=need.note,
            resolved_at=need.resolved_at,
        )
        for need, pathway in rows
    ]


def get_open_pathway_id(db: Session, patient_id: uuid.UUID) -> uuid.UUID | None:
    """For other modules: the patient's open pathway, if any. No access check."""
    query = select(CarePathway.id).where(
        CarePathway.patient_id == patient_id, CarePathway.status == PathwayStatus.OPEN
    )
    return db.scalar(query)


def get_last_closed_pathway_id(db: Session, patient_id: uuid.UUID) -> uuid.UUID | None:
    """For other modules: the patient's most recently closed pathway. No access check."""
    query = (
        select(CarePathway.id)
        .where(CarePathway.patient_id == patient_id, CarePathway.status == PathwayStatus.CLOSED)
        .order_by(CarePathway.closed_at.desc())
        .limit(1)
    )
    return db.scalar(query)


def count_open(db: Session) -> int:
    """For analytics: how many pathways are open."""
    query = select(func.count()).where(CarePathway.status == PathwayStatus.OPEN)
    return db.scalar(query.select_from(CarePathway)) or 0


def average_self_assessment_change(db: Session) -> tuple[int, dict[str, float | None]]:
    """For analytics: over pathways with both an intake and a final review, the average change
    per dimension (final minus intake), in one query. Totals only."""
    intake, final = aliased(PathwayMilestone), aliased(PathwayMilestone)
    query = (
        select(
            func.count(),
            *(func.avg(getattr(final, d) - getattr(intake, d)) for d in DIMENSIONS),
        )
        .select_from(intake)
        .join(final, and_(final.pathway_id == intake.pathway_id, final.kind == MilestoneKind.FINAL))
        .where(intake.kind == MilestoneKind.INTAKE)
    )
    count, *averages = db.execute(query).one()
    return count, {
        d: round(float(a), 2) if a is not None else None
        for d, a in zip(DIMENSIONS, averages, strict=True)
    }


def _summary(
    pathway: CarePathway, milestones: list[PathwayMilestone], patient_name: str
) -> PathwaySummary:
    recorded = {m.kind for m in milestones}
    next_kind = next((k for k in MILESTONE_ORDER if k not in recorded), None)
    due = pathway.opened_at + DUE_AFTER_OPENING[next_kind] if next_kind else None
    return PathwaySummary(
        id=pathway.id,
        patient_id=pathway.patient_id,
        patient_name=patient_name,
        opened_at=pathway.opened_at,
        next_milestone=next_kind,
        next_due_on=due.date() if due else None,
    )


def _is_team_coordinator(db: Session, user: CurrentUser, patient_id: uuid.UUID) -> bool:
    return user.role == Role.COORDINATOR and care_team.is_in_care_team(db, user.id, patient_id)


def _pathways_of(db: Session, patient_id: uuid.UUID) -> list[CarePathway]:
    query = select(CarePathway).where(CarePathway.patient_id == patient_id)
    return list(db.scalars(query.order_by(CarePathway.opened_at.desc())))


def _milestones_by_pathway(
    db: Session, pathway_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[PathwayMilestone]]:
    """All milestones of these pathways in one query, in pathway order."""
    by_pathway: dict[uuid.UUID, list[PathwayMilestone]] = defaultdict(list)
    if pathway_ids:
        query = select(PathwayMilestone).where(PathwayMilestone.pathway_id.in_(pathway_ids))
        for milestone in db.scalars(query):
            by_pathway[milestone.pathway_id].append(milestone)
    for milestones in by_pathway.values():
        milestones.sort(key=lambda m: MILESTONE_ORDER.index(m.kind))
    return by_pathway


def _to_out(db: Session, pathways: list[CarePathway]) -> list[PathwayOut]:
    milestones = _milestones_by_pathway(db, [p.id for p in pathways])
    coordinator_ids = list({p.coordinator_id for p in pathways})
    names = {u.id: u.full_name for u in identity.get_users(db, coordinator_ids)} if pathways else {}
    return [
        PathwayOut(
            id=p.id,
            patient_id=p.patient_id,
            coordinator_id=p.coordinator_id,
            coordinator_name=names.get(p.coordinator_id, ""),
            status=p.status,
            opened_at=p.opened_at,
            closed_at=p.closed_at,
            milestones=[Milestone.model_validate(m) for m in milestones[p.id]],
        )
        for p in pathways
    ]


def _get(db: Session, pathway_id: uuid.UUID) -> CarePathway:
    pathway = db.get(CarePathway, pathway_id)
    if pathway is None:
        raise NotFoundError("Pathway not found")
    return pathway


def _deny(db: Session, user: CurrentUser, action: str, patient_id: uuid.UUID) -> NoReturn:
    audit.record(db, user.id, action, patient_id)
    db.commit()
    raise ForbiddenError("You are not allowed to do this for this patient")
