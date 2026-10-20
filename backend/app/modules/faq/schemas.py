"""Request/response shapes for FAQ entries and categories."""

import uuid

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    position: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    position: int | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int


class EntryCreate(BaseModel):
    category_id: uuid.UUID
    question: str = Field(min_length=1, max_length=300)
    answer: str = Field(min_length=1)
    published: bool = False
    position: int = 0


class EntryUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    question: str | None = Field(default=None, min_length=1, max_length=300)
    answer: str | None = Field(default=None, min_length=1)
    published: bool | None = None
    position: int | None = None


class EntryOut(BaseModel):
    """An entry as admins see it, published or not."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID
    question: str
    answer: str
    published: bool
    position: int


class PublicEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question: str
    answer: str


class PublicCategory(BaseModel):
    """What everyone sees: a category and its published entries, in order."""

    id: uuid.UUID
    name: str
    entries: list[PublicEntry]
