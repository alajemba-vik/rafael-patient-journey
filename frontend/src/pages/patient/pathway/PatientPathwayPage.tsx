import { useMyPathways } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { MILESTONE_LABELS } from "../../../components/labels";
import { PageHeader } from "../../../components/layout/PageHeader";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";

export function PatientPathwayPage() {
  const pathways = useMyPathways();

  return (
    <div className="rf-narrow">
      <PageHeader title="Votre parcours" />
      <QueryState
        query={pathways}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: "Votre parcours n’a pas encore commencé.",
          children: <p>Il commencera avec votre premier bilan auprès de votre coordinatrice ou coordinateur.</p>,
        }}
      >
        {([current]) => (
          <>
            <section className="rf-section">
              <dl className="rf-dl">
                <dt>Votre coordinatrice ou coordinateur</dt>
                <dd>{current.coordinator_name}</dd>
                <dt>Commencé le</dt>
                <dd>{formatDate(current.opened_at)}</dd>
                {current.closed_at && (
                  <>
                    <dt>Terminé le</dt>
                    <dd>{formatDate(current.closed_at)}</dd>
                  </>
                )}
              </dl>
            </section>

            {current.milestones.length === 0 ? (
              <p>Vos bilans apparaîtront ici.</p>
            ) : (
              <>
                <section className="rf-section" aria-labelledby="scores-title">
                  <h2 id="scores-title" className="rf-title">
                    Votre auto-évaluation
                  </h2>
                  <MilestonesTable milestones={current.milestones} />
                </section>
                {current.milestones.map((m) => (
                  <section key={m.kind} className="rf-section" aria-labelledby={`milestone-${m.kind}`}>
                    <h2 id={`milestone-${m.kind}`} className="rf-title">
                      {MILESTONE_LABELS[m.kind]} · {formatDate(m.recorded_at)}
                    </h2>
                    <dl className="rf-dl">
                      {m.goals && (
                        <>
                          <dt>Vos objectifs</dt>
                          <dd>{m.goals}</dd>
                        </>
                      )}
                      {m.plan && (
                        <>
                          <dt>Soins convenus</dt>
                          <dd>{m.plan}</dd>
                        </>
                      )}
                      {m.symptoms.length > 0 && (
                        <>
                          <dt>Symptômes (intensité sur 10)</dt>
                          <dd>{m.symptoms.map((s) => `${s.name} (${s.intensity})`).join(", ")}</dd>
                        </>
                      )}
                    </dl>
                  </section>
                ))}
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
