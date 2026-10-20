import { useEffect, useState, type ReactNode } from "react";

/** Placeholder lines shaped like content. Shown only after a short delay, so fast loads don't flash. */
export function LoadingState({ lines = 3, delayMs = 250 }: { lines?: number; delayMs?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className="rf-skeleton" role="status" aria-label="Chargement en cours">
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
  return (
    <div className="rf-state" role="alert">
      <p className="rf-state__title">Impossible de charger ces informations.</p>
      <p>Vérifiez votre connexion, puis réessayez.</p>
      {onRetry && (
        <button type="button" className="rf-btn rf-btn--secondary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function NotAllowedState() {
  return (
    <div className="rf-state" role="alert">
      <p className="rf-state__title">Vous n’avez pas accès à cette page.</p>
      <p>Si vous pensez que c’est une erreur, contactez l’administrateur de la plateforme.</p>
    </div>
  );
}
