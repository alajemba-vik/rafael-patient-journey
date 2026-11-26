import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { FaqCategory, FaqEntry } from "../../../api/faq";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextArea } from "../../../components/forms/TextArea";
import { TextField } from "../../../components/forms/TextField";

type EntryFields = { category_id: string; question: string; answer: string };

type Props = {
  categories: FaqCategory[];
  initial?: FaqEntry;
  submitLabel: string;
  pending: boolean;
  failed: boolean;
  onSubmit: (fields: EntryFields) => void;
  onCancel?: () => void;
};

/** Writing or editing a question and its answer. */
export function EntryForm({ categories, initial, submitLabel, pending, failed, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<EntryFields>({
    category_id: initial?.category_id ?? categories[0]?.id ?? "",
    question: initial?.question ?? "",
    answer: initial?.answer ?? "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ ...fields, question: fields.question.trim(), answer: fields.answer.trim() });
  }

  return (
    <form className="rf-form" onSubmit={submit}>
      <SelectField
        label={t("faqAdmin.category")}
        required
        value={fields.category_id}
        onChange={(e) => setFields({ ...fields, category_id: e.target.value })}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t("faqAdmin.question")}
        required
        maxLength={300}
        value={fields.question}
        onChange={(e) => setFields({ ...fields, question: e.target.value })}
      />
      <TextArea
        label={t("faqAdmin.answer")}
        required
        rows={6}
        value={fields.answer}
        onChange={(e) => setFields({ ...fields, answer: e.target.value })}
      />
      {failed && (
        <p className="rf-field__error" role="alert">
          {t("faqAdmin.saveFailed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
