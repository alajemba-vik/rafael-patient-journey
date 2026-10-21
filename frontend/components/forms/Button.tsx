import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** While true the button shows a spinner and can't be clicked again. */
  pending?: boolean;
};

export function Button({ variant = "primary", pending = false, disabled, children, ...rest }: Props) {
  const className = variant === "primary" ? "rf-btn" : "rf-btn rf-btn--secondary";
  return (
    <button type="button" {...rest} className={className} disabled={disabled || pending} aria-busy={pending}>
      {pending && <span className="rf-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
