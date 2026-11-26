import { useTranslation } from "react-i18next";

import { usePatientScores } from "../../../api/questionnaires";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatMonth, formatNumber } from "../../../lib/format";

const MONTHS_SHOWN = 4;

export function ScoresSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const scores = usePatientScores(patientId);

  return (
    <section className="rf-panel" aria-labelledby="scores-title">
      <h2 id="scores-title" className="rf-title">
        {t("scores.title")}
      </h2>
      <QueryState query={scores} empty={{ isEmpty: (list) => list.length === 0, title: t("scores.empty") }}>
        {(list) => (
          <table className="rf-table">
            <caption className="rf-muted">{t("scores.caption")}</caption>
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
