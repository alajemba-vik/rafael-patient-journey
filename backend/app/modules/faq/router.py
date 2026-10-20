import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.faq import service
from app.modules.faq.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    EntryCreate,
    EntryOut,
    EntryUpdate,
    PublicCategory,
)
from app.modules.identity_access.service import CurrentUser, get_current_user

router = APIRouter(prefix="/faq", tags=["faq"])


@router.get("")
def list_published(db: Session = Depends(get_db)) -> list[PublicCategory]:
    """Public: no login needed."""
    return service.list_published(db)


@router.get("/categories")
def list_categories(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[CategoryOut]:
    return service.list_categories(db, user)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    return service.create_category(db, user, body)


@router.patch("/categories/{category_id}")
def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    return service.update_category(db, user, category_id, body)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_category(db, user, category_id)


@router.get("/entries")
def list_entries(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[EntryOut]:
    return service.list_entries(db, user)


@router.post("/entries", status_code=status.HTTP_201_CREATED)
def create_entry(
    body: EntryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryOut:
    return service.create_entry(db, user, body)


@router.patch("/entries/{entry_id}")
def update_entry(
    entry_id: uuid.UUID,
    body: EntryUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntryOut:
    return service.update_entry(db, user, entry_id, body)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_entry(db, user, entry_id)
