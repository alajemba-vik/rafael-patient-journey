"""FAQ rules: everyone reads published entries; only admins manage content. Synthetic content."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.modules.faq.models import FaqCategory, FaqEntry
from app.modules.identity_access.service import Role

NON_ADMIN_ROLES = [Role.PATIENT, Role.SECRETARY, Role.PROFESSIONAL, Role.COORDINATOR]


def add_category(db: Session, name: str = "Rendez-vous", position: int = 0) -> FaqCategory:
    category = FaqCategory(name=name, position=position)
    db.add(category)
    db.commit()
    return category


def add_entry(
    db: Session, category: FaqCategory, question: str, published: bool = True, position: int = 0
) -> FaqEntry:
    entry = FaqEntry(
        category_id=category.id,
        question=question,
        answer="Réponse de démonstration.",
        published=published,
        position=position,
    )
    db.add(entry)
    db.commit()
    return entry


# --- public ---------------------------------------------------------------


def test_anyone_reads_published_entries_grouped_and_ordered(db):
    first = add_category(db, "Rendez-vous", position=0)
    second = add_category(db, "Soins", position=1)
    add_entry(db, second, "Les soins sont-ils gratuits ?")
    add_entry(db, first, "Comment annuler ?", position=1)
    add_entry(db, first, "Comment prendre rendez-vous ?", position=0)
    add_entry(db, first, "Brouillon", published=False)

    body = TestClient(app).get("/api/v1/faq").json()

    assert [c["name"] for c in body] == ["Rendez-vous", "Soins"]
    assert [e["question"] for e in body[0]["entries"]] == [
        "Comment prendre rendez-vous ?",
        "Comment annuler ?",
    ]


def test_category_without_published_entries_is_hidden(db):
    add_entry(db, add_category(db), "Brouillon", published=False)

    body = TestClient(app).get("/api/v1/faq").json()

    assert body == []


# --- manage ---------------------------------------------------------------


def test_admin_creates_category_and_entry(db, client_as):
    client = client_as(Role.ADMIN)

    category = client.post("/api/v1/faq/categories", json={"name": "Accès"}).json()
    response = client.post(
        "/api/v1/faq/entries",
        json={"category_id": category["id"], "question": "Où est l'Institut ?", "answer": "…"},
    )

    assert response.status_code == 201
    assert response.json()["published"] is False


def test_admin_publishes_and_edits_entry(db, client_as):
    entry = add_entry(db, add_category(db), "Ancienne question", published=False)

    response = client_as(Role.ADMIN).patch(
        f"/api/v1/faq/entries/{entry.id}", json={"published": True, "question": "Nouvelle"}
    )

    assert response.json()["published"] is True
    assert response.json()["question"] == "Nouvelle"


def test_admin_sees_unpublished_entries(db, client_as):
    add_entry(db, add_category(db), "Brouillon", published=False)

    body = client_as(Role.ADMIN).get("/api/v1/faq/entries").json()

    assert [e["question"] for e in body] == ["Brouillon"]


def test_admin_deletes_entry(db, client_as):
    entry = add_entry(db, add_category(db), "À supprimer")

    response = client_as(Role.ADMIN).delete(f"/api/v1/faq/entries/{entry.id}")

    assert response.status_code == 204
    assert db.scalar(select(FaqEntry)) is None


def test_category_with_entries_cannot_be_deleted(db, client_as):
    category = add_category(db)
    add_entry(db, category, "Encore là")

    response = client_as(Role.ADMIN).delete(f"/api/v1/faq/categories/{category.id}")

    assert response.status_code == 409


def test_duplicate_category_name_is_refused(db, client_as):
    add_category(db, "Accès")

    response = client_as(Role.ADMIN).post("/api/v1/faq/categories", json={"name": "Accès"})

    assert response.status_code == 409


@pytest.mark.parametrize("role", NON_ADMIN_ROLES)
def test_non_admin_cannot_manage_faq(db, client_as, role):
    category = add_category(db)
    client = client_as(role)

    responses = [
        client.get("/api/v1/faq/entries"),
        client.post("/api/v1/faq/categories", json={"name": "Autre"}),
        client.post(
            "/api/v1/faq/entries",
            json={"category_id": str(category.id), "question": "Q", "answer": "R"},
        ),
        client.delete(f"/api/v1/faq/categories/{category.id}"),
    ]

    assert {r.status_code for r in responses} == {403}
