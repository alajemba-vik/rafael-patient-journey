import { usePatientPathways } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { MILESTONE_LABELS } from "../../../components/labels";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";
import { NeedForm } from "./NeedForm";

export function PathwaySection({ patientId }: { patientId: string }) {
  const pathways = usePatientPathways(patientId);

  return (
    <section className="rf-section" aria-labelledby="pathway-title">
      <h2 id="pathway-title" className="rf-title">
        Parcours
      </h2>
      <QueryState query={pathways} empty={{ isEmpty: (list) => list.length === 0, title: "Aucun parcours ouvert." }}>
        {([current]) => (
          <div className="rf-stack">
            <p>
              Coordination : <strong>{current.coordinator_name}</strong> · ouvert le {formatDate(current.opened_at)}
              {current.closed_at ? ` · terminé le ${formatDate(current.closed_at)}` : ""}
            </p>
            {current.milestones.length > 0 && <MilestonesTable milestones={current.milestones} />}
            {current.milestones.map((m) => (
              <details key={m.kind} className="rf-disclosure">
                <summary>
                  {MILESTONE_LABELS[m.kind]} · {formatDate(m.recorded_at)}
                </summary>
                <dl className="rf-dl rf-disclosure__body">
                  {m.symptoms.length > 0 && (
                    <>
                      <dt>Symptômes (sur 10)</dt>
                      <dd>{m.symptoms.map((s) => `${s.name} (${s.intensity})`).join(", ")}</dd>
                    </>
                  )}
                  {m.goals && (
                    <>
                      <dt>Objectifs</dt>
                      <dd>{m.goals}</dd>
                    </>
                  )}
                  {m.plan && (
                    <>
                      <dt>Soins convenus</dt>
                      <dd>{m.plan}</dd>
                    </>
                  )}
                  {m.note && (
                    <>
                      <dt>Note de coordination</dt>
                      <dd>{m.note}</dd>
                    </>
                  )}
                </dl>
              </details>
            ))}
            {current.status === "open" && (
              <div className="rf-narrow">
                <NeedForm pathwayId={current.id} coordinatorName={current.coordinator_name} />
              </div>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
