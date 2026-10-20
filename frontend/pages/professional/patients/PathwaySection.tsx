import { useState } from "react";

import { useMe } from "../../../api/me";
import { useClosePathway, useOpenPathway, usePatientPathways, type Pathway } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { formatDate } from "../../../components/format";
import { MILESTONE_LABELS } from "../../../components/labels";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";
import { MilestoneForm } from "./MilestoneForm";
import { NeedForm } from "./NeedForm";

const MILESTONE_ORDER = ["intake", "review", "final"] as const;

export function PathwaySection({ patientId }: { patientId: string }) {
  const pathways = usePatientPathways(patientId);
  const isCoordinator = useMe().data?.role === "coordinator";
  const open = useOpenPathway();

  return (
    <section className="rf-section" aria-labelledby="pathway-title">
      <h2 id="pathway-title" className="rf-title">
        Parcours
      </h2>
      <QueryState query={pathways}>
        {(list) => {
          const current = list[0];
          if (!current || current.status === "closed") {
            return (
              <div className="rf-stack">
                <p>{current ? `Dernier parcours terminé le ${formatDate(current.closed_at ?? "")}.` : "Aucun parcours ouvert."}</p>
                {isCoordinator && (
                  <div>
                    <Button onClick={() => open.mutate(patientId)} pending={open.isPending}>
                      Ouvrir un parcours
                    </Button>
                  </div>
                )}
                {current && <PathwayDetails pathway={current} />}
              </div>
            );
          }
          return (
            <div className="rf-stack">
              <PathwayDetails pathway={current} />
              {isCoordinator && <CoordinatorActions pathway={current} />}
              <div className="rf-narrow">
                <NeedForm pathwayId={current.id} coordinatorName={current.coordinator_name} />
              </div>
            </div>
          );
        }}
      </QueryState>
    </section>
  );
}

function PathwayDetails({ pathway }: { pathway: Pathway }) {
  return (
    <>
      <p>
        Coordination : <strong>{pathway.coordinator_name}</strong> · ouvert le {formatDate(pathway.opened_at)}
        {pathway.closed_at ? ` · terminé le ${formatDate(pathway.closed_at)}` : ""}
      </p>
      {pathway.milestones.length > 0 && <MilestonesTable milestones={pathway.milestones} />}
      {pathway.milestones.map((m) => (
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
    </>
  );
}

function CoordinatorActions({ pathway }: { pathway: Pathway }) {
  const close = useClosePathway();
  const [recording, setRecording] = useState(false);
  const recorded = new Set(pathway.milestones.map((m) => m.kind));
  const next = MILESTONE_ORDER.find((kind) => !recorded.has(kind));

  return (
    <div className="rf-stack">
      {next && !recording && (
        <div>
          <Button onClick={() => setRecording(true)}>Enregistrer le {MILESTONE_LABELS[next].toLowerCase()}</Button>
        </div>
      )}
      {next && recording && (
        <div className="rf-panel rf-narrow">
          <h3 className="rf-title">{MILESTONE_LABELS[next]}</h3>
          <MilestoneForm pathwayId={pathway.id} kind={next} onDone={() => setRecording(false)} />
          <div>
            <Button variant="secondary" onClick={() => setRecording(false)}>
              Fermer sans enregistrer
            </Button>
          </div>
        </div>
      )}
      <div>
        <ConfirmButton
          question="Clore ce parcours ? Le questionnaire de satisfaction sera proposé au patient."
          confirmLabel="Clore le parcours"
          onConfirm={() => close.mutate(pathway.id)}
          pending={close.isPending}
        >
          Clore le parcours
        </ConfirmButton>
      </div>
    </div>
  );
}
