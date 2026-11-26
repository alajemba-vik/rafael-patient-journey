import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "../../../api/identity_access";
import { useMyPathways } from "../../../api/pathways";
import { useDueQuestionnaires, useMyScores } from "../../../api/questionnaires";
import { useMyAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatDate, formatNumber, formatTime, formatWeekday } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

const UPCOMING_SHOWN = 3;

export function PatientHomePage() {
  const { t } = useTranslation();
  const me = useMe();
  const due = useDueQuestionnaires();
  const appointments = useMyAppointments();
  const pathways = useMyPathways();
  const scores = useMyScores();
  const firstName = me.data?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={t("patientHome.title")} />

      {/* Message d'accueil personnalisé et chaleureux */}
      {firstName && (
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "36px",
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: "var(--space-7)",
            letterSpacing: "-0.5px",
          }}
        >
          <Trans
            i18nKey="patientHome.greeting"
            values={{ name: firstName }}
            components={{ name: <span style={{ color: "var(--accent)" }} /> }}
          />
        </h2>
      )}

      <div className="rf-grid">
        {/* 1. QUESTIONNAIRE EN ATTENTE (Mis en évidence) */}
        {due.data && due.data.length > 0 && (
          <section className="rf-panel rf-panel--highlight" aria-labelledby="due-title">
            <h2 id="due-title" className="rf-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span aria-hidden="true">📝</span> {t("patientHome.dueTitle")}
            </h2>
            <p style={{ margin: "var(--space-3) 0" }}>{t("patientHome.dueText", { title: due.data[0].title })}</p>
            <Link to={paths.patient.questionnaires} className="rf-btn">
              {t("patientHome.answerNow")}
            </Link>
          </section>
        )}

        {/* 2. PROCHAINS RENDEZ-VOUS */}
        <section className="rf-panel" aria-labelledby="next-title">
          <h2 id="next-title" className="rf-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span aria-hidden="true">📅</span> {t("patientHome.nextTitle")}
          </h2>
          <QueryState
            query={appointments}
            empty={{ isEmpty: (list) => list.length === 0, title: t("patientHome.noAppointments") }}
          >
            {(list) => (
              <div
                style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}
              >
                <ul className="rf-list">
                  {list.slice(0, UPCOMING_SHOWN).map((a) => (
                    <li key={a.id} style={{ padding: "var(--space-4) 0" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontWeight: 600, fontSize: "15px" }}>
                          {t("patientHome.appointmentAt", {
                            day: formatWeekday(a.starts_at),
                            time: formatTime(a.starts_at),
                          })}
                        </span>
                        <span className="rf-muted">{t("patientHome.with", { name: a.professional_name })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link to={paths.patient.appointments} className="rf-link" style={{ marginTop: "auto" }}>
                  {t("patientHome.allAppointments")}
                </Link>
              </div>
            )}
          </QueryState>
        </section>

        {/* 3. PARCOURS */}
        <section className="rf-panel" aria-labelledby="pathway-title">
          <h2 id="pathway-title" className="rf-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span aria-hidden="true">🧭</span> {t("patientHome.pathwayTitle")}
          </h2>
          <QueryState
            query={pathways}
            empty={{ isEmpty: (list) => list.length === 0, title: t("patientHome.pathwayNotStarted") }}
          >
            {([current]) => (
              <div
                style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}
              >
                <dl className="rf-dl" style={{ marginBottom: "var(--space-4)" }}>
                  <dt>{t("patientHome.coordinator")}</dt>
                  <dd>{current.coordinator_name}</dd>
                  <dt>{t("patientHome.startedOn")}</dt>
                  <dd>{formatDate(current.opened_at)}</dd>
                </dl>
                <Link to={paths.patient.pathway} className="rf-link" style={{ marginTop: "auto" }}>
                  {t("patientHome.seePathway")}
                </Link>
              </div>
            )}
          </QueryState>
        </section>

        {/* 4. QUALITÉ DE VIE */}
        <section className="rf-panel" aria-labelledby="score-title">
          <h2 id="score-title" className="rf-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span aria-hidden="true">📊</span> {t("patientHome.scoreTitle")}
          </h2>
          <QueryState
            query={scores}
            empty={{
              isEmpty: (list) => list.length === 0,
              title: t("patientHome.scoreEmpty"),
            }}
          >
            {(list) => {
              const latest = list[list.length - 1];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span className="rf-figure" style={{ color: "var(--accent)", fontSize: "42px" }}>
                      {formatNumber(latest.score)}
                    </span>
                    <span className="rf-muted">{t("patientHome.outOf100")}</span>
                  </p>

                  {/* Petite barre visuelle pour le score */}
                  <div
                    style={{
                      height: "8px",
                      background: "var(--surface-tint)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: `${latest.score}%`, height: "100%", background: "var(--accent)" }}></div>
                  </div>

                  {latest.change !== null && (
                    <p className="rf-muted" style={{ margin: 0, fontSize: "13px" }}>
                      {t("patientHome.changeSinceLastMonth", { change: formatChange(latest.change) })}
                    </p>
                  )}
                </div>
              );
            }}
          </QueryState>
        </section>
      </div>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientHomePage as Component };
