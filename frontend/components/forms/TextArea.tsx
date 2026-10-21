import { useId, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string };

/** Multi-line text with its label above and hint or error below, like TextField. */
export function TextArea({ label, error, hint, id, ...rest }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className="rf-field">
      <label className="rf-field__label" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        rows={4}
        {...rest}
        id={inputId}
        className="rf-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <p id={noteId} className={error ? "rf-field__error" : "rf-field__hint"}>
          {note}
        </p>
      )}
    </div>
  );
}
