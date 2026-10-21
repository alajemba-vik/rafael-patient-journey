import { useState, type ReactNode } from "react";

import { Button } from "./Button";

type Props = {
  children: ReactNode;
  /** The question asked before acting, e.g. "Annuler ce rendez-vous ?" */
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
};

/** A button that asks once more, inline, before something that can't be undone. */
export function ConfirmButton({ children, question, confirmLabel, onConfirm, pending = false }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button variant="secondary" onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="rf-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <Button onClick={onConfirm} pending={pending}>
        {confirmLabel}
      </Button>
      <Button variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
        Retour
      </Button>
    </span>
  );
}
