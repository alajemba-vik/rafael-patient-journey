import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../../api/core/client";
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
  const { t } = useTranslation();
  const categories = useFaqCategories();
  const entries = useFaqEntries();
  const createEntry = useCreateEntry();
  const [formKey, setFormKey] = useState(0);

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      <PageHeader title={t("faqAdmin.title")} />

      <p
        className="rf-muted"
        style={{
          background: "var(--secondary-blue)",
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-xs)",
          display: "inline-block",
          marginBottom: "var(--space-6)",
        }}
      >
        {t("faqAdmin.intro")}
      </p>

      <QueryState query={categories}>
        {(cats) => (
          <>
            <CategoriesSection categories={cats} />

            {cats.length > 0 && (
              <details className="rf-disclosure rf-section" style={{ marginBottom: "var(--space-6)" }}>
                <summary>{t("faqAdmin.addQuestion")}</summary>
                <div className="rf-disclosure__body" style={{ maxWidth: "640px", marginTop: "var(--space-4)" }}>
                  <EntryForm
                    key={formKey}
                    categories={cats}
                    submitLabel={t("faqAdmin.saveDraft")}
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

            <QueryState query={entries} empty={{ isEmpty: (list) => list.length === 0, title: t("faqAdmin.empty") }}>
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
    </div>
  );
}

function CategoriesSection({ categories }: { categories: FaqCategory[] }) {
  const { t } = useTranslation();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), position: categories.length }, { onSuccess: () => setName("") });
  }

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409 ? t("faqAdmin.categoryNotEmpty") : undefined;

  return (
    <section className="rf-section" aria-labelledby="categories-title">
      <h2 id="categories-title" className="rf-title" style={{ marginBottom: "var(--space-4)" }}>
        {t("faqAdmin.categories")}
      </h2>

      {categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                background: "var(--surface-raised)",
                border: "1px solid var(--hairline)",
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--radius-xs)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
              <ConfirmButton
                question={t("faqAdmin.deleteCategoryQuestion", { name: c.name })}
                confirmLabel={t("faqAdmin.delete")}
                onConfirm={() => remove.mutate(c.id)}
                pending={remove.isPending && remove.variables === c.id}
              >
                <span style={{ color: "#E53935", fontSize: "18px", lineHeight: 1 }}>×</span>
              </ConfirmButton>
            </div>
          ))}
        </div>
      )}

      {removeError && (
        <p className="rf-field__error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
          {removeError}
        </p>
      )}

      <form
        className="rf-toolbar"
        onSubmit={submit}
        style={{ background: "var(--surface-tint)", padding: "var(--space-4)", borderRadius: "var(--radius-md)" }}
      >
        <div style={{ width: "100%", maxWidth: "300px" }}>
          <TextField
            label={t("faqAdmin.newCategory")}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" pending={create.isPending}>
          {t("faqAdmin.addCategory")}
        </Button>
      </form>

      {create.error instanceof ApiError && create.error.status === 409 && (
        <p className="rf-field__error" role="alert" style={{ marginTop: "var(--space-2)" }}>
          {t("faqAdmin.categoryExists")}
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
    <section className="rf-section" aria-label={category.name}>
      <h2
        className="rf-title"
        style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--space-4)" }}
      >
        <span aria-hidden="true">📁</span> {category.name}
      </h2>

      <div className="rf-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} categories={categories} />
        ))}
      </div>
    </section>
  );
}

function EntryRow({ entry, categories }: { entry: FaqEntry; categories: FaqCategory[] }) {
  const { t } = useTranslation();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rf-panel" style={{ gridColumn: "1 / -1", border: "2px solid var(--accent)" }}>
        <h3 style={{ margin: "0 0 var(--space-4) 0", color: "var(--accent)" }}>{t("faqAdmin.editQuestion")}</h3>
        <EntryForm
          categories={categories}
          initial={entry}
          submitLabel={t("common.save")}
          pending={update.isPending}
          failed={update.isError}
          onSubmit={(body) => update.mutate({ id: entry.id, body }, { onSuccess: () => setEditing(false) })}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rf-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* En-tête : Question + Statut */}
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)", lineHeight: 1.4 }}>{entry.question}</h3>
        <span
          className={`rf-badge ${entry.published ? "rf-badge--arrived" : ""}`}
          style={{
            background: entry.published ? "var(--secondary-green)" : "var(--accent-doux)",
            color: entry.published ? "#166534" : "#92400E",
            border: "none",
            whiteSpace: "nowrap",
          }}
        >
          {entry.published ? t("faqAdmin.published") : t("faqAdmin.draft")}
        </span>
      </div>

      {/* Réponse (tronquée) */}
      <p
        className="rf-muted"
        style={{
          margin: 0,
          fontSize: "14px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {entry.answer}
      </p>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginTop: "auto",
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <Button
          variant={entry.published ? "secondary" : "primary"}
          className="rf-btn--compact"
          pending={update.isPending}
          onClick={() => update.mutate({ id: entry.id, body: { published: !entry.published } })}
        >
          {entry.published ? t("faqAdmin.unpublish") : t("faqAdmin.publish")}
        </Button>
        <Button variant="secondary" className="rf-btn--compact" onClick={() => setEditing(true)}>
          {t("faqAdmin.edit")}
        </Button>
        <div style={{ marginLeft: "auto" }}>
          <ConfirmButton
            question={t("faqAdmin.deleteQuestion")}
            confirmLabel={t("faqAdmin.delete")}
            onConfirm={() => remove.mutate(entry.id)}
            pending={remove.isPending}
          >
            <span style={{ color: "#E53935" }}>{t("faqAdmin.deleteButton")}</span>
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

export { FaqAdminPage as Component };
