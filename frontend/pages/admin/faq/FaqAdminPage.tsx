import { useState, type FormEvent } from "react";

import { ApiError } from "../../../api/client";
import {
  useCreateCategory,
  useCreateEntry,
  useDeleteCategory,
  useDeleteEntry,
  useFaqCategories,
  useFaqEntries,
  useUpdateEntry,
  type FaqCategory,
  type FaqEntry,
} from "../../../api/faq";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { TextField } from "../../../components/forms/TextField";
import { PageHeader } from "../../../components/layout/PageHeader";
import { EntryForm } from "./EntryForm";

export function FaqAdminPage() {
  const categories = useFaqCategories();
  const entries = useFaqEntries();
  const createEntry = useCreateEntry();
  // A fresh, empty form after each question saved; a failed save keeps the text.
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <PageHeader title="Gérer la FAQ" />
      <p className="rf-muted rf-section">
        Les questions publiées sont visibles par tous sur la page publique, sans connexion. Les brouillons restent
        visibles ici seulement.
      </p>
      <QueryState query={categories}>
        {(cats) => (
          <>
            <CategoriesSection categories={cats} />
            {cats.length > 0 && (
              <details className="rf-disclosure rf-section">
                <summary>Ajouter une question</summary>
                <div className="rf-disclosure__body rf-narrow">
                  <EntryForm
                    key={formKey}
                    categories={cats}
                    submitLabel="Enregistrer comme brouillon"
                    pending={createEntry.isPending}
                    failed={createEntry.isError}
                    onSubmit={(fields) =>
                      createEntry.mutate(
                        { ...fields, published: false, position: 0 },
                        { onSuccess: () => setFormKey((k) => k + 1) },
                      )
                    }
                  />
                </div>
              </details>
            )}
            <QueryState
              query={entries}
              empty={{ isEmpty: (list) => list.length === 0, title: "Aucune question pour le moment." }}
            >
              {(list) =>
                cats.map((category) => (
                  <EntriesOfCategory
                    key={category.id}
                    category={category}
                    categories={cats}
                    entries={list.filter((e) => e.category_id === category.id)}
                  />
                ))
              }
            </QueryState>
          </>
        )}
      </QueryState>
    </>
  );
}

function CategoriesSection({ categories }: { categories: FaqCategory[] }) {
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), position: categories.length }, { onSuccess: () => setName("") });
  }

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "Cette catégorie contient encore des questions : déplacez-les ou supprimez-les d’abord."
      : undefined;

  return (
    <section className="rf-section rf-narrow" aria-labelledby="categories-title">
      <h2 id="categories-title" className="rf-title">
        Catégories
      </h2>
      {categories.length > 0 && (
        <ul className="rf-list">
          {categories.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <ConfirmButton
                question={`Supprimer « ${c.name} » ?`}
                confirmLabel="Supprimer"
                onConfirm={() => remove.mutate(c.id)}
                pending={remove.isPending && remove.variables === c.id}
              >
                Supprimer
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      {removeError && (
        <p className="rf-field__error" role="alert">
          {removeError}
        </p>
      )}
      <form className="rf-toolbar" onSubmit={submit}>
        <TextField label="Nouvelle catégorie" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="secondary" pending={create.isPending}>
          Ajouter
        </Button>
      </form>
      {create.error instanceof ApiError && create.error.status === 409 && (
        <p className="rf-field__error" role="alert">
          Une catégorie porte déjà ce nom.
        </p>
      )}
    </section>
  );
}

function EntriesOfCategory({
  category,
  categories,
  entries,
}: {
  category: FaqCategory;
  categories: FaqCategory[];
  entries: FaqEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <section className="rf-section rf-narrow" aria-label={category.name}>
      <h2 className="rf-title">{category.name}</h2>
      <ul className="rf-list">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} categories={categories} />
        ))}
      </ul>
    </section>
  );
}

function EntryRow({ entry, categories }: { entry: FaqEntry; categories: FaqCategory[] }) {
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <div className="rf-stack">
          <EntryForm
            categories={categories}
            initial={entry}
            submitLabel="Enregistrer"
            pending={update.isPending}
            failed={update.isError}
            onSubmit={(body) => update.mutate({ id: entry.id, body }, { onSuccess: () => setEditing(false) })}
            onCancel={() => setEditing(false)}
          />
        </div>
      </li>
    );
  }
  return (
    <li>
      <div className="rf-stack">
        <p>
          <strong>{entry.question}</strong>{" "}
          <span className={`rf-badge ${entry.published ? "rf-badge--arrived" : ""}`}>
            {entry.published ? "Publiée" : "Brouillon"}
          </span>
        </p>
        <p className="rf-muted">{entry.answer}</p>
      </div>
      <div className="rf-actions">
        <Button
          variant={entry.published ? "secondary" : "primary"}
          className="rf-btn--compact"
          pending={update.isPending}
          onClick={() => update.mutate({ id: entry.id, body: { published: !entry.published } })}
        >
          {entry.published ? "Retirer" : "Publier"}
        </Button>
        <Button variant="secondary" className="rf-btn--compact" onClick={() => setEditing(true)}>
          Modifier
        </Button>
        <ConfirmButton
          question="Supprimer cette question ?"
          confirmLabel="Supprimer"
          onConfirm={() => remove.mutate(entry.id)}
          pending={remove.isPending}
        >
          Supprimer
        </ConfirmButton>
      </div>
    </li>
  );
}
