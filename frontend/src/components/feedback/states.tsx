import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Placeholder lines shaped like content. Shown only after a short delay, so fast loads don't flash. */
export function LoadingState({ lines = 3, delayMs = 250 }: { lines?: number; delayMs?: number }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className="rf-skeleton" role="status" aria-label={t("feedback.loading")}>
      {visible && Array.from({ length: lines }, (_, i) => <span key={i} className="rf-skeleton__line" />)}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rf-state">
      <p className="rf-state__title">{title}</p>
      {children}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rf-state" role="alert">
      <p className="rf-state__title">{t("feedback.errorTitle")}</p>
      <p>{t("feedback.errorHint")}</p>
      {onRetry && (
        <button type="button" className="rf-btn rf-btn--secondary" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function NotAllowedState() {
  const { t } = useTranslation();
  return (
    <div className="rf-state" role="alert">
      <p className="rf-state__title">{t("feedback.notAllowedTitle")}</p>
      <p>{t("feedback.notAllowedHint")}</p>
    </div>
  );
}
