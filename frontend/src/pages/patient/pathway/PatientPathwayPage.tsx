import { useTranslation } from "react-i18next";

import { useMyPathways } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";

export function PatientPathwayPage() {
  const { t } = useTranslation();
  const pathways = useMyPathways();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader title={t("patientPathway.title")} />

      <QueryState
        query={pathways}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("patientPathway.notStarted"),
          children: <p>{t("patientPathway.notStartedHint")}</p>,
        }}
      >
        {([current]) => (
          <>
            {/* Bandeau d'introduction du parcours */}
            <section
              className="rf-panel"
              style={{
                marginBottom: "var(--space-7)",
                borderLeft: "6px solid var(--accent)",
                background: "var(--secondary-blue)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)" }}>
                <div>
                  <span className="rf-muted" style={{ display: "block", marginBottom: "4px" }}>
                    {t("patientPathway.coordinator")}
                  </span>
                  <strong style={{ fontSize: "18px", color: "var(--ink)" }}>{current.coordinator_name}</strong>
                </div>
                <div>
                  <span className="rf-muted" style={{ display: "block", marginBottom: "4px" }}>
                    {t("patientPathway.start")}
                  </span>
                  <strong style={{ fontSize: "18px", color: "var(--ink)" }}>{formatDate(current.opened_at)}</strong>
                </div>
                {current.closed_at && (
                  <div>
                    <span className="rf-muted" style={{ display: "block", marginBottom: "4px" }}>
                      {t("patientPathway.end")}
                    </span>
                    <strong style={{ fontSize: "18px", color: "var(--ink)" }}>{formatDate(current.closed_at)}</strong>
                  </div>
                )}
              </div>
            </section>

            {current.milestones.length === 0 ? (
              <p className="rf-lead">{t("patientPathway.noMilestones")}</p>
            ) : (
              <>
                {/* Le tableau d'auto-évaluation, mis en valeur */}
                <section className="rf-section" aria-labelledby="scores-title">
                  <h2 id="scores-title" className="rf-title" style={{ marginBottom: "var(--space-4)" }}>
                    {t("patientPathway.scoresTitle")}
                  </h2>
                  <div className="rf-panel" style={{ padding: "var(--space-4) 0" }}>
                    <MilestonesTable milestones={current.milestones} />
                  </div>
                </section>

                {/* La chronologie des bilans */}
                <section className="rf-section">
                  <h2 className="rf-title" style={{ marginBottom: "var(--space-4)" }}>
                    {t("patientPathway.stepsTitle")}
                  </h2>

                  <div className="rf-timeline">
                    {current.milestones.map((m) => (
                      <div key={m.kind} className="rf-timeline-item">
                        <div className="rf-panel" style={{ padding: "var(--space-5)" }}>
                          {/* Titre de l'étape */}
                          <h3
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "20px",
                              color: "var(--ink)",
                              marginBottom: "var(--space-4)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <span>{t(`labels.milestone.${m.kind}`)}</span>
                            <span style={{ fontSize: "14px", color: "var(--accent)", fontWeight: 700 }}>
                              {formatDate(m.recorded_at)}
                            </span>
                          </h3>

                          {/* Contenu détaillé de l'étape */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                            {m.goals && (
                              <div>
                                <strong
                                  style={{
                                    color: "var(--accent)",
                                    display: "block",
                                    marginBottom: "4px",
                                    fontSize: "14px",
                                  }}
                                >
                                  {t("patientPathway.goals")}
                                </strong>
                                <span style={{ color: "var(--ink)" }}>{m.goals}</span>
                              </div>
                            )}
                            {m.plan && (
                              <div>
                                <strong
                                  style={{
                                    color: "var(--accent)",
                                    display: "block",
                                    marginBottom: "4px",
                                    fontSize: "14px",
                                  }}
                                >
                                  {t("patientPathway.plan")}
                                </strong>
                                <span style={{ color: "var(--ink)" }}>{m.plan}</span>
                              </div>
                            )}
                            {m.symptoms.length > 0 && (
                              <div>
                                <strong
                                  style={{
                                    color: "var(--accent)",
                                    display: "block",
                                    marginBottom: "4px",
                                    fontSize: "14px",
                                  }}
                                >
                                  {t("patientPathway.symptoms")}
                                </strong>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                                  {m.symptoms.map((s, idx) => (
                                    <span key={idx} className="rf-badge" style={{ borderColor: "var(--hairline)" }}>
                                      {t("patientPathway.symptom", { name: s.name })}
                                      <strong style={{ color: "var(--ink)" }}>{s.intensity}</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientPathwayPage as Component };
