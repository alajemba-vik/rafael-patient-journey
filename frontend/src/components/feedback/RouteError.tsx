import { useTranslation } from "react-i18next";

import { paths } from "../../app/paths";

/** Shown instead of the app when something unexpected breaks: a way out, never a stack trace. */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <div className="rf-root rf-shell">
      <main className="rf-shell__main rf-narrow">
        <h1 className="rf-display-lg">{t("feedback.routeErrorTitle")}</h1>
        <div className="rf-state" role="alert">
          <p>{t("feedback.routeErrorText")}</p>
          <div className="rf-actions">
            <button type="button" className="rf-btn" onClick={() => window.location.reload()}>
              {t("feedback.reload")}
            </button>
            <a className="rf-btn rf-btn--secondary" href={paths.home}>
              {t("feedback.backHome")}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
