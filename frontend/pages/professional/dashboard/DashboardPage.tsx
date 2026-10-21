import { useDashboard } from "../../../api/analytics";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatDate, formatMonth, formatNumber } from "../../../components/format";
import { DIMENSIONS } from "../../../components/labels";
import { PageHeader } from "../../../components/layout/PageHeader";

const HIDDEN = "Masqué";

/** A count hidden because too few patients are behind it, worded so it still reads naturally. */
const FEW = "moins de 5";

/** "3 séances", or "moins de 5 séances" when the count is hidden. */
function counted(value: number | null, noun: string): string {
  if (value === null) return `${FEW} ${noun}s`;
  return `${value} ${noun}${value > 1 ? "s" : ""}`;
}

/** An average, or "Masqué" when too few patients are behind it to stay anonymous. */
function shown(value: number | null, format = formatNumber): string {
  return value === null ? HIDDEN : format(value);
}

export function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <>
      <PageHeader title="Tableau de bord" />
      <QueryState query={dashboard}>
        {(data) => (
          <>
            <p className="rf-muted">
              Données anonymisées. Les chiffres portant sur moins de {data.min_group_size} patients sont masqués.
            </p>
            <div className="rf-grid rf-section">
              <section className="rf-panel" aria-labelledby="active-title">
                <h2 id="active-title" className="rf-title">
                  Parcours en cours
                </h2>
                <p className="rf-figure">{data.active_pathways}</p>
              </section>
              <section className="rf-panel" aria-labelledby="attendance-title">
                <h2 id="attendance-title" className="rf-title">
                  Absences
                </h2>
                <p>
                  <span className="rf-figure">{shown(data.attendance.no_show_rate)}</span>
                  {data.attendance.no_show_rate !== null && " %"}
                </p>
                <p className="rf-muted">
                  {counted(data.attendance.no_show, "absence")} sur{" "}
                  {counted(
                    data.attendance.done === null ? null : data.attendance.done + (data.attendance.no_show ?? 0),
                    "séance",
                  )}{" "}
                  depuis le {formatDate(data.attendance.since)}
                </p>
              </section>
              <section className="rf-panel" aria-labelledby="satisfaction-title">
                <h2 id="satisfaction-title" className="rf-title">
                  Satisfaction
                </h2>
                <p>
                  <span className="rf-figure">{shown(data.satisfaction.average)}</span>
                  {data.satisfaction.average !== null && " / 100"}
                </p>
                <p className="rf-muted">{counted(data.satisfaction.respondents, "réponse")} en fin de parcours</p>
              </section>
            </div>

            <section className="rf-section" aria-labelledby="qol-title">
              <h2 id="qol-title" className="rf-title">
                Qualité de vie, moyenne par mois
              </h2>
              <div className="rf-table-wrap">
                <table className="rf-table">
                  <caption className="rf-muted">Sur 100 : plus le résultat est élevé, mieux c’est.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mois</th>
                      <th scope="col" className="rf-num">
                        Répondants
                      </th>
                      <th scope="col">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.quality_of_life.map((m) => (
                      <tr key={m.period}>
                        <td>{formatMonth(m.period)}</td>
                        <td className="rf-num">{m.respondents ?? FEW}</td>
                        <td>
                          {m.average === null ? (
                            HIDDEN
                          ) : (
                            <span className="rf-bar">
                              <span className="rf-bar__fill" style={{ width: `${m.average}%` }} />
                              {formatNumber(m.average)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rf-grid">
              <section className="rf-panel" aria-labelledby="change-title">
                <h2 id="change-title" className="rf-title">
                  Évolution entre premier bilan et bilan final
                </h2>
                <p className="rf-muted">
                  Auto-évaluation de 0 à 4, sur {data.self_assessment.pathways ?? FEW} parcours terminés
                </p>
                <table className="rf-table">
                  <tbody>
                    {DIMENSIONS.map(([key, label]) => {
                      const change = data.self_assessment.by_dimension.find((d) => d.dimension === key);
                      return (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          <td className="rf-num">{shown(change?.average_change ?? null, formatChange)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="rf-panel" aria-labelledby="questions-title">
                <h2 id="questions-title" className="rf-title">
                  Satisfaction par question
                </h2>
                <table className="rf-table">
                  <tbody>
                    {data.satisfaction.by_question.map((q) => (
                      <tr key={q.question}>
                        <th scope="row">{q.question}</th>
                        <td className="rf-num">{shown(q.average)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { DashboardPage as Component };
