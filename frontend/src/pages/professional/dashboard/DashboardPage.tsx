import { useDashboard } from "../../../api/analytics";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatDate, formatMonth, formatNumber } from "../../../lib/format";
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

// Composant pour les grosses stats
function StatCard({ title, value, suffix, subtitle, icon }: { title: string, value: string | number, suffix?: string, subtitle?: string, icon: string }) {
  return (
    <section className="rf-panel" style={{ borderTop: '4px solid var(--accent)', padding: 'var(--space-5)' }} aria-label={title}>
      <h2 className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: 'var(--ink-muted)' }}>
        <span aria-hidden="true">{icon}</span> {title}
      </h2>
      <p style={{ margin: 'var(--space-4) 0 var(--space-2) 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '42px', 
          fontWeight: 800, 
          color: 'var(--ink)',
          lineHeight: 1
        }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-muted)' }}>{suffix}</span>}
      </p>
      {subtitle && <p className="rf-muted" style={{ fontSize: '13px', margin: 0 }}>{subtitle}</p>}
    </section>
  );
}

export function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <PageHeader title="Tableau de bord" />
      
      <QueryState query={dashboard}>
        {(data) => (
          <>
            {/* Bandeau d'information */}
            <p className="rf-muted" style={{ 
              background: 'var(--secondary-blue)', 
              padding: 'var(--space-3) var(--space-4)', 
              borderRadius: 'var(--radius-xs)',
              display: 'inline-block',
              marginBottom: 'var(--space-6)'
            }}>
              🔒 Données anonymisées. Les chiffres portant sur moins de {data.min_group_size} patients sont masqués.
            </p>

            {/* 1. Les 3 grosses stats du haut */}
            <div className="rf-grid rf-section" style={{ marginBottom: 'var(--space-7)' }}>
              <StatCard 
                title="Parcours en cours" 
                value={data.active_pathways} 
                icon="🧭"
              />
              <StatCard 
                title="Absences" 
                value={shown(data.attendance.no_show_rate)} 
                suffix={data.attendance.no_show_rate !== null ? "%" : ""} 
                subtitle={`${counted(data.attendance.no_show, "absence")} sur ${counted(data.attendance.done === null ? null : data.attendance.done + (data.attendance.no_show ?? 0), "séance")}`}
                icon="📉"
              />
              <StatCard 
                title="Satisfaction" 
                value={shown(data.satisfaction.average)} 
                suffix={data.satisfaction.average !== null ? "/ 100" : ""} 
                subtitle={`${counted(data.satisfaction.respondents, "réponse")} en fin de parcours`}
                icon="⭐"
              />
            </div>

            {/* 2. Tableau Qualité de vie */}
            <section className="rf-section" aria-labelledby="qol-title">
              <h2 id="qol-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <span aria-hidden="true">📈</span> Qualité de vie, moyenne par mois
              </h2>
              <div className="rf-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="rf-table-wrap">
                  <table className="rf-table" style={{ margin: 0 }}>
                    <caption className="rf-muted" style={{ padding: 'var(--space-4)', textAlign: 'left', borderBottom: '1px solid var(--hairline)' }}>
                      Sur 100 : plus le résultat est élevé, mieux c’est.
                    </caption>
                    <thead>
                      <tr style={{ background: 'var(--surface-tint)' }}>
                        <th scope="col" style={{ paddingLeft: 'var(--space-5)' }}>Mois</th>
                        <th scope="col" className="rf-num">Répondants</th>
                        <th scope="col" style={{ width: '50%' }}>Moyenne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.quality_of_life.map((m) => (
                        <tr key={m.period}>
                          <td style={{ paddingLeft: 'var(--space-5)', fontWeight: 600, textTransform: 'capitalize' }}>
                            {formatMonth(m.period)}
                          </td>
                          <td className="rf-num">{m.respondents ?? FEW}</td>
                          <td>
                            {m.average === null ? (
                              <span className="rf-muted">{HIDDEN}</span>
                            ) : (
                              // Barre de progression personnalisée
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}>
                                <div style={{ flex: 1, height: '8px', background: 'var(--surface-tint)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${m.average}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px' }} />
                                </div>
                                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--ink)', width: '35px', textAlign: 'right' }}>
                                  {formatNumber(m.average)}
                                </strong>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 3. Tableaux du bas (Évolution et Satisfaction) */}
            <div className="rf-grid rf-section">
              
              <section className="rf-panel" aria-labelledby="change-title">
                <h2 id="change-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                  <span aria-hidden="true">🌱</span> Évolution (Premier vs Final)
                </h2>
                <p className="rf-muted" style={{ fontSize: '13px', marginBottom: 'var(--space-3)' }}>
                  Auto-évaluation de 0 à 4, sur {data.self_assessment.pathways ?? FEW} parcours terminés
                </p>
                <div className="rf-table-wrap">
                  <table className="rf-table">
                    <tbody>
                      {DIMENSIONS.map(([key, label]) => {
                        const change = data.self_assessment.by_dimension.find((d) => d.dimension === key);
                        const val = change?.average_change ?? null;
                        return (
                          <tr key={key}>
                            <th scope="row" style={{ fontWeight: 600, fontSize: '14px' }}>{label}</th>
                            <td className="rf-num">
                              {val === null ? <span className="rf-muted">{HIDDEN}</span> : (
                                <span style={{ 
                                  color: val > 0 ? '#43A047' : val < 0 ? '#E53935' : 'var(--ink)', 
                                  fontWeight: 800,
                                  background: val > 0 ? 'var(--secondary-green)' : val < 0 ? '#FEE2E2' : 'transparent',
                                  padding: '4px 8px',
                                  borderRadius: '4px'
                                }}>
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

              <section className="rf-panel" aria-labelledby="questions-title">
                <h2 id="questions-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                  <span aria-hidden="true">💬</span> Satisfaction par question
                </h2>
                <div className="rf-table-wrap">
                  <table className="rf-table">
                    <tbody>
                      {data.satisfaction.by_question.map((q) => (
                        <tr key={q.question}>
                          <th scope="row" style={{ fontWeight: 500, fontSize: '14px', color: 'var(--ink-muted)' }}>
                            {q.question}
                          </th>
                          <td className="rf-num">
                            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{shown(q.average)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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