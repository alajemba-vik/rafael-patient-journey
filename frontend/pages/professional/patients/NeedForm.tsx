import { useState, type FormEvent } from "react";

import { useRaiseNeed } from "../../../api/pathways";
import { Button } from "../../../components/forms/Button";
import { TextArea } from "../../../components/forms/TextArea";

/** A practitioner tells the referent coordinator about a new need. */
export function NeedForm({ pathwayId, coordinatorName }: { pathwayId: string; coordinatorName: string }) {
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
        label={`Signaler un besoin à ${coordinatorName}`}
        hint="Par exemple : une nouvelle douleur, une difficulté à évoquer en coordination."
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setSent(false);
        }}
        required
        maxLength={2000}
        error={raise.isError ? "L’envoi n’a pas abouti. Votre texte est conservé : réessayez." : undefined}
      />
      {sent && (
        <p className="rf-banner" role="status">
          Besoin transmis à {coordinatorName}.
        </p>
      )}
      <Button type="submit" variant="secondary" pending={raise.isPending} disabled={note.trim() === ""}>
        Signaler
      </Button>
    </form>
  );
}
