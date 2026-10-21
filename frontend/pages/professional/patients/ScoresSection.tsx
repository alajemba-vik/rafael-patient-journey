import { usePatientScores } from "../../../api/questionnaires";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatMonth, formatNumber } from "../../../components/format";

const MONTHS_SHOWN = 4;

export function ScoresSection({ patientId }: { patientId: string }) {
  const scores = usePatientScores(patientId);

  return (
    <section className="rf-panel" aria-labelledby="scores-title">
      <h2 id="scores-title" className="rf-title">
        Qualité de vie
      </h2>
      <QueryState
        query={scores}
        empty={{ isEmpty: (list) => list.length === 0, title: "Pas encore de questionnaire." }}
      >
        {(list) => (
          <table className="rf-table">
            <caption className="rf-muted">Sur 100, derniers mois</caption>
            <tbody>
              {list
                .slice(-MONTHS_SHOWN)
                .reverse()
                .map((s) => (
                  <tr key={s.period}>
                    <th scope="row">{formatMonth(s.period)}</th>
                    <td className="rf-num">{formatNumber(s.score)}</td>
                    <td className="rf-num rf-muted">{s.change === null ? "" : formatChange(s.change)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </QueryState>
    </section>
  );
}
