import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** While true the button shows a spinner and can't be clicked again. */
  pending?: boolean;
};

export function Button({ variant = "primary", pending = false, disabled, className, children, ...rest }: Props) {
  const classes = ["rf-btn", variant === "secondary" && "rf-btn--secondary", className].filter(Boolean).join(" ");
  return (
    <button type="button" {...rest} className={classes} disabled={disabled || pending} aria-busy={pending}>
      {pending && <span className="rf-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
