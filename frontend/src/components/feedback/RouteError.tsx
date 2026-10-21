import { paths } from "../../app/paths";

/** Shown instead of the app when something unexpected breaks: a way out, never a stack trace. */
export function RouteError() {
  return (
    <div className="rf-root rf-shell">
      <main className="rf-shell__main rf-narrow">
        <h1 className="rf-display-lg">Une erreur est survenue</h1>
        <div className="rf-state" role="alert">
          <p>La page n’a pas pu s’afficher. Rechargez-la ; si le problème continue, revenez à l’accueil.</p>
          <div className="rf-actions">
            <button type="button" className="rf-btn" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
            <a className="rf-btn rf-btn--secondary" href={paths.home}>
              Retour à l’accueil
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
