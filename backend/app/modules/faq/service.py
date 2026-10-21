"""Admins create, edit, publish and order entries; everyone reads published entries.

No patient data lives here, so nothing is audited.
"""

import uuid
from itertools import groupby

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.modules.faq.models import FaqCategory, FaqEntry
from app.modules.faq.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    EntryCreate,
    EntryOut,
    EntryUpdate,
    PublicCategory,
    PublicEntry,
)
from app.modules.identity_access.service import CurrentUser, Role


def list_published(db: Session) -> list[PublicCategory]:
    """The public FAQ in one query: categories with at least one published entry."""
    rows = db.execute(
        select(FaqCategory, FaqEntry)
        .join(FaqEntry, FaqEntry.category_id == FaqCategory.id)
        .where(FaqEntry.published.is_(True))
        .order_by(FaqCategory.position, FaqCategory.name, FaqEntry.position, FaqEntry.question)
    )
    return [
        PublicCategory(
            id=category.id,
            name=category.name,
            entries=[PublicEntry.model_validate(entry) for _, entry in pairs],
        )
        for category, pairs in groupby(rows, key=lambda row: row[0])
    ]


def list_categories(db: Session, user: CurrentUser) -> list[CategoryOut]:
    _require_editor(user)
    categories = db.scalars(select(FaqCategory).order_by(FaqCategory.position, FaqCategory.name))
    return [CategoryOut.model_validate(c) for c in categories]


def create_category(db: Session, user: CurrentUser, data: CategoryCreate) -> CategoryOut:
    _require_editor(user)
    _check_name_free(db, data.name)
    category = FaqCategory(**data.model_dump())
    db.add(category)
    db.commit()
    return CategoryOut.model_validate(category)


def update_category(
    db: Session, user: CurrentUser, category_id: uuid.UUID, data: CategoryUpdate
) -> CategoryOut:
    _require_editor(user)
    category = _get_category(db, category_id)
    if data.name is not None and data.name != category.name:
        _check_name_free(db, data.name)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(category, field, value)
    db.commit()
    return CategoryOut.model_validate(category)


def delete_category(db: Session, user: CurrentUser, category_id: uuid.UUID) -> None:
    _require_editor(user)
    category = _get_category(db, category_id)
    if db.scalar(select(FaqEntry.id).where(FaqEntry.category_id == category_id).limit(1)):
        raise ConflictError("Move or delete this category's entries first")
    db.delete(category)
    db.commit()


def list_entries(db: Session, user: CurrentUser) -> list[EntryOut]:
    _require_editor(user)
    entries = db.scalars(select(FaqEntry).order_by(FaqEntry.position, FaqEntry.question))
    return [EntryOut.model_validate(e) for e in entries]


def create_entry(db: Session, user: CurrentUser, data: EntryCreate) -> EntryOut:
    _require_editor(user)
    _get_category(db, data.category_id)
    entry = FaqEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    return EntryOut.model_validate(entry)


def update_entry(
    db: Session, user: CurrentUser, entry_id: uuid.UUID, data: EntryUpdate
) -> EntryOut:
    _require_editor(user)
    entry = _get_entry(db, entry_id)
    if data.category_id is not None:
        _get_category(db, data.category_id)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(entry, field, value)
    db.commit()
    return EntryOut.model_validate(entry)


def delete_entry(db: Session, user: CurrentUser, entry_id: uuid.UUID) -> None:
    _require_editor(user)
    db.delete(_get_entry(db, entry_id))
    db.commit()


def _require_editor(user: CurrentUser) -> None:
    # TODO(validate): who maintains the FAQ at the Institute: admins only, or also
    # coordinators or reception? (V-13)
    if user.role != Role.ADMIN:
        raise ForbiddenError("Only admins can manage the FAQ")


def _get_category(db: Session, category_id: uuid.UUID) -> FaqCategory:
    category = db.get(FaqCategory, category_id)
    if category is None:
        raise NotFoundError("Category not found")
    return category


def _get_entry(db: Session, entry_id: uuid.UUID) -> FaqEntry:
    entry = db.get(FaqEntry, entry_id)
    if entry is None:
        raise NotFoundError("Entry not found")
    return entry


def _check_name_free(db: Session, name: str) -> None:
    if db.scalar(select(FaqCategory.id).where(FaqCategory.name == name)) is not None:
        raise ConflictError("A category with this name already exists")
