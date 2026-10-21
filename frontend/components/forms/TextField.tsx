import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Label above the input, hint or error below it, wired up for screen readers. */
export function TextField({ label, error, hint, id, ...rest }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className="rf-field">
      <label className="rf-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
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
