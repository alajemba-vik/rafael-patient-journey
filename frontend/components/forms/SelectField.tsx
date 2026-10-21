import { useId, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string };

/** A native select with its label above: accessible and familiar on every device. */
export function SelectField({ label, hint, id, children, ...rest }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="rf-field">
      <label className="rf-field__label" htmlFor={selectId}>
        {label}
      </label>
      <select {...rest} id={selectId} className="rf-input" aria-describedby={hint ? `${selectId}-hint` : undefined}>
        {children}
      </select>
      {hint && (
        <p id={`${selectId}-hint`} className="rf-field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
