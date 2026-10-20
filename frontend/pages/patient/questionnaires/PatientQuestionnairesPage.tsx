import { useState } from "react";

import { useDueQuestionnaires, useMyScores } from "../../../api/questionnaires";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatMonth, formatNumber } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { QuestionnaireForm } from "./QuestionnaireForm";

export function PatientQuestionnairesPage() {
  const due = useDueQuestionnaires();
  const scores = useMyScores();
  // Kept here: once answered, the questionnaire is no longer due and its form disappears.
  const [lastScore, setLastScore] = useState<number | null>(null);

  return (
    <div className="rf-narrow">
      <PageHeader title="Questionnaires" />
      {lastScore !== null && (
        <p className="rf-banner" role="status">
          Merci, vos réponses sont enregistrées. Résultat : {formatNumber(lastScore)} / 100.
        </p>
      )}
      <section className="rf-section" aria-labelledby="due-title">
        <QueryState
          query={due}
          empty={{
            isEmpty: (list) => list.length === 0,
            title: "Aucun questionnaire à remplir pour le moment.",
            children: <p>Le prochain vous attendra ici au début du mois.</p>,
          }}
        >
          {([next]) => (
            <>
              <h2 id="due-title" className="rf-title">
                {next.title}
              </h2>
              <QuestionnaireForm key={next.instrument} questionnaire={next} onSubmitted={setLastScore} />
            </>
          )}
        </QueryState>
      </section>

      <section className="rf-section" aria-labelledby="results-title">
        <h2 id="results-title" className="rf-title">
          Vos résultats de qualité de vie
        </h2>
        <QueryState
          query={scores}
          empty={{ isEmpty: (list) => list.length === 0, title: "Pas encore de résultat." }}
        >
          {(list) => (
            <div className="rf-table-wrap">
              <table className="rf-table">
                <caption className="rf-muted">Sur 100 : plus le résultat est élevé, mieux c’est.</caption>
                <thead>
                  <tr>
                    <th scope="col">Mois</th>
                    <th scope="col" className="rf-num">
                      Résultat
                    </th>
                    <th scope="col" className="rf-num">
                      Évolution
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...list].reverse().map((s) => (
                    <tr key={s.period}>
                      <td>{formatMonth(s.period)}</td>
                      <td className="rf-num">{formatNumber(s.score)}</td>
                      <td className="rf-num">{s.change === null ? "—" : formatChange(s.change)}</td>
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
