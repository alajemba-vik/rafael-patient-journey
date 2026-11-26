import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDueQuestionnaires, useMyScores } from "../../../api/questionnaires";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatMonth, formatNumber } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { QuestionnaireForm } from "./QuestionnaireForm";

export function PatientQuestionnairesPage() {
  const { t } = useTranslation();
  const due = useDueQuestionnaires();
  const scores = useMyScores();
  const [lastScore, setLastScore] = useState<number | null>(null);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader title={t("patientQuestionnaires.title")} />

      {lastScore !== null && (
        <div
          className="rf-panel rf-panel--highlight"
          style={{ marginBottom: "var(--space-6)", background: "var(--secondary-green)" }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }} role="status">
            {t("patientQuestionnaires.thanks", { score: formatNumber(lastScore) })}
          </p>
        </div>
      )}

      <section className="rf-section" aria-labelledby="due-title">
        <QueryState
          query={due}
          empty={{
            isEmpty: (list) => list.length === 0,
            title: t("patientQuestionnaires.empty"),
            children: <p>{t("patientQuestionnaires.emptyHint")}</p>,
          }}
        >
          {([next]) => (
            <div className="rf-panel" style={{ padding: "var(--space-7)" }}>
              <h2 id="due-title" className="rf-title" style={{ fontSize: "26px", marginBottom: "var(--space-2)" }}>
                {next.title}
              </h2>
              <QuestionnaireForm key={next.instrument} questionnaire={next} onSubmitted={setLastScore} />
            </div>
          )}
        </QueryState>
      </section>

      <section className="rf-section" aria-labelledby="results-title">
        <h2 id="results-title" className="rf-title">
          {t("patientQuestionnaires.resultsTitle")}
        </h2>
        <QueryState
          query={scores}
          empty={{ isEmpty: (list) => list.length === 0, title: t("patientQuestionnaires.noResults") }}
        >
          {(list) => (
            <div className="rf-table-wrap rf-panel" style={{ padding: "0", overflow: "hidden" }}>
              <table className="rf-table" style={{ margin: 0 }}>
                <caption
                  className="rf-muted"
                  style={{ padding: "var(--space-4)", textAlign: "left", borderBottom: "1px solid var(--hairline)" }}
                >
                  {t("patientQuestionnaires.caption")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ paddingLeft: "var(--space-5)" }}>
                      {t("patientQuestionnaires.month")}
                    </th>
                    <th scope="col" className="rf-num">
                      {t("patientQuestionnaires.score")}
                    </th>
                    <th scope="col" className="rf-num" style={{ paddingRight: "var(--space-5)" }}>
                      {t("patientQuestionnaires.change")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...list].reverse().map((s) => (
                    <tr key={s.period}>
                      <td style={{ paddingLeft: "var(--space-5)" }}>{formatMonth(s.period)}</td>
                      <td className="rf-num">{formatNumber(s.score)}</td>
                      <td className="rf-num" style={{ paddingRight: "var(--space-5)" }}>
                        {s.change === null ? "—" : formatChange(s.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </section>
    </div>
  );
}

export { PatientQuestionnairesPage as Component };
