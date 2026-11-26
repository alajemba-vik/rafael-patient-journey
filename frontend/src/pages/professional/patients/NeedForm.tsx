import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useRaiseNeed } from "../../../api/pathways";
import { Button } from "../../../components/forms/Button";
import { TextArea } from "../../../components/forms/TextArea";

/** A practitioner tells the referent coordinator about a new need. */
export function NeedForm({ pathwayId, coordinatorName }: { pathwayId: string; coordinatorName: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const raise = useRaiseNeed();

  function send(event: FormEvent) {
    event.preventDefault();
    raise.mutate(
      { pathwayId, note: note.trim() },
      {
        onSuccess: () => {
          setNote("");
          setSent(true);
        },
      },
    );
  }

  return (
    <form className="rf-form" onSubmit={send}>
      <TextArea
        label={t("need.label", { name: coordinatorName })}
        hint={t("need.hint")}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setSent(false);
        }}
        required
        maxLength={2000}
        error={raise.isError ? t("need.failed") : undefined}
      />
      {sent && (
        <p className="rf-banner" role="status">
          {t("need.sent", { name: coordinatorName })}
        </p>
      )}
      <Button type="submit" variant="secondary" pending={raise.isPending} disabled={note.trim() === ""}>
        {t("need.submit")}
      </Button>
    </form>
  );
}
