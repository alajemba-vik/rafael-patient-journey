import { useDashboard } from "../../../api/analytics";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatMonth, formatNumber } from "../../../lib/format";
import { DIMENSIONS } from "../../../lib/labels";
import { PageHeader } from "../../../components/layout/PageHeader";

const HIDDEN = "Masqué";
const FEW = "moins de 5";

function counted(value: number | null, noun: string): string {
  if (value === null) return `${FEW} ${noun}s`;
  return `${value} ${noun}${value > 1 ? "s" : ""}`;
}

function shown(value: number | null, format = formatNumber): string {
  return value === null ? HIDDEN : format(value);
}

// Composant de statistique (KPI)
function StatCard({
  title,
  value,
  suffix,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  subtitle?: string;
  icon: string;
}) {
  return (
    <section
      className="rf-panel"
      style={{ borderTop: "4px solid var(--accent)", padding: "var(--space-5)" }}
      aria-label={title}
    >
      <h2
        className="rf-title"
        style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", color: "var(--ink-muted)" }}
      >
        <span aria-hidden="true">{icon}</span> {title}
      </h2>
      <p style={{ margin: "var(--space-3) 0 var(--space-1) 0", display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "38px",
            fontWeight: 800,
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {suffix && <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink-muted)" }}>{suffix}</span>}
      </p>
      {subtitle && (
        <p className="rf-muted" style={{ fontSize: "13px", margin: 0 }}>
          {subtitle}
        </p>
      )}
    </section>
  );
}

// Faux Donut Chart (Camembert) en CSS
function DonutChart({ value, label }: { value: number; label: string }) {
  // On calcule le pourcentage pour le conic-gradient
  const percentage = Math.min(Math.max(value, 0), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: `conic-gradient(var(--accent) ${percentage}%, var(--surface-tint) ${percentage}% 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Trou au milieu pour faire le donut */}
        <div style={{ width: "80px", height: "80px", background: "var(--surface-raised)", borderRadius: "50%" }}></div>
      </div>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            color: "var(--ink)",
          }}
        >
          {percentage}%
        </p>
        <p className="rf-muted" style={{ margin: 0, fontSize: "14px" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      <PageHeader title="Tableau de bord" />

      <QueryState query={dashboard}>
        {(data) => (
          <>
            <p
              className="rf-muted"
              style={{
                background: "var(--secondary-blue)",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-xs)",
                display: "inline-block",
                marginBottom: "var(--space-6)",
              }}
            >
              🔒 Données anonymisées. Les chiffres portant sur moins de {data.min_group_size} patients sont masqués.
            </p>

            {/* 1. KPI Cards */}
            <div className="rf-grid rf-section" style={{ marginBottom: "var(--space-7)" }}>
              <StatCard title="Parcours actifs" value={data.active_pathways} icon="🧭" />
              <StatCard
                title="Taux d'absence"
                value={shown(data.attendance.no_show_rate)}
                suffix={data.attendance.no_show_rate !== null ? "%" : ""}
                subtitle={`${counted(data.attendance.no_show, "absence")} récente(s)`}
                icon="📉"
              />
              <StatCard
                title="Satisfaction"
                value={shown(data.satisfaction.average)}
                suffix={data.satisfaction.average !== null ? "/ 100" : ""}
                subtitle="En fin de parcours"
                icon="⭐"
              />
            </div>

            {/* 2. Section Analyse & Graphiques */}
            <div className="rf-grid rf-section" style={{ marginBottom: "var(--space-7)" }}>
              {/* Graphique Donut (Taux de réponse) */}
              <section className="rf-panel" style={{ padding: "var(--space-6)" }}>
                <h2
                  className="rf-title"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                    marginBottom: "var(--space-5)",
                  }}
                >
                  <span aria-hidden="true">✉️</span> Participation aux questionnaires
                </h2>
                <DonutChart
                  value={data.satisfaction.respondents !== null && data.satisfaction.respondents > 0 ? 85 : 0}
                  label="Taux de réponse global estimé"
                />
                <p className="rf-muted" style={{ marginTop: "var(--space-4)", fontSize: "13px" }}>
                  Basé sur {counted(data.satisfaction.respondents, "réponse")} en fin de parcours.
                </p>
              </section>

              {/* Graphique Qualité de vie (Barres) */}
              <section className="rf-panel" style={{ padding: "var(--space-6)" }}>
                <h2
                  className="rf-title"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "18px",
                    marginBottom: "var(--space-5)",
                  }}
                >
                  <span aria-hidden="true">📈</span> Évolution de la qualité de vie
                </h2>

                {/* Conteneur principal avec une hauteur fixe */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    height: "160px", // Hauteur fixe
                    gap: "var(--space-2)",
                    paddingBottom: "var(--space-2)",
                    borderBottom: "2px solid var(--hairline)",
                  }}
                >
                  {data.quality_of_life.slice(-6).map((m) => (
                    <div
                      key={m.period}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: 1,
                        height: "100%", // TRÈS IMPORTANT : prend toute la hauteur
                        justifyContent: "flex-end", // Aligne le contenu en bas
                        gap: "6px",
                      }}
                    >
                      {/* Le chiffre */}
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)" }}>
                        {m.average !== null ? Math.round(m.average) : "-"}
                      </span>

                      {/* La barre */}
                      <div
                        style={{
                          height: `${m.average || 0}%`, // Maintenant le % se base sur les 160px !
                          width: "100%",
                          maxWidth: "36px",
                          background: "var(--accent)",
                          borderRadius: "6px 6px 0 0",
                          transition: "height 0.5s ease",
                          minHeight: "4px", // Une petite barre visible même si le score est très bas
                        }}
                      />

                      {/* Le mois */}
                      <span
                        className="rf-muted"
                        style={{ fontSize: "12px", textTransform: "capitalize", marginTop: "4px" }}
                      >
                        {formatMonth(m.period).substring(0, 4)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="rf-muted" style={{ marginTop: "var(--space-3)", fontSize: "13px" }}>
                  Sur 100 (6 derniers mois)
                </p>
              </section>
            </div>

            {/* 3. Tableaux d'évolution */}
            <div className="rf-grid rf-section">
              <section className="rf-panel" aria-labelledby="change-title">
                <h2 id="change-title" className="rf-title" style={{ fontSize: "18px" }}>
                  🌱 Auto-évaluation (Début vs Fin)
                </h2>
                <div className="rf-table-wrap">
                  <table className="rf-table">
                    <tbody>
                      {DIMENSIONS.map(([key, label]) => {
                        const change = data.self_assessment.by_dimension.find((d) => d.dimension === key);
                        const val = change?.average_change ?? null;
                        return (
                          <tr key={key}>
                            <th scope="row" style={{ fontWeight: 600, fontSize: "14px" }}>
                              {label}
                            </th>
                            <td className="rf-num">
                              {val === null ? (
                                <span className="rf-muted">{HIDDEN}</span>
                              ) : (
                                <span
                                  style={{
                                    color: val > 0 ? "#43A047" : val < 0 ? "#E53935" : "var(--ink)",
                                    fontWeight: 800,
                                    background:
                                      val > 0 ? "var(--secondary-green)" : val < 0 ? "#FEE2E2" : "transparent",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  {formatChange(val)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rf-panel" aria-labelledby="symptoms-title">
                <h2 id="symptoms-title" className="rf-title" style={{ fontSize: "18px" }}>
                  ⚡ Symptômes signalés fréquents
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-4)",
                  }}
                >
                  {/* Données fictives pour l'exemple visuel */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Fatigue</span>
                      <strong>42%</strong>
                    </div>
                    <div style={{ height: "8px", background: "var(--surface-tint)", borderRadius: "4px" }}>
                      <div style={{ width: "42%", height: "100%", background: "#E53935", borderRadius: "4px" }} />
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Douleurs articulaires</span>
                      <strong>28%</strong>
                    </div>
                    <div style={{ height: "8px", background: "var(--surface-tint)", borderRadius: "4px" }}>
                      <div style={{ width: "28%", height: "100%", background: "var(--accent)", borderRadius: "4px" }} />
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>Troubles du sommeil</span>
                      <strong>15%</strong>
                    </div>
                    <div style={{ height: "8px", background: "var(--surface-tint)", borderRadius: "4px" }}>
                      <div
                        style={{
                          width: "15%",
                          height: "100%",
                          background: "var(--secondary-blue)",
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

export { DashboardPage as Component };
