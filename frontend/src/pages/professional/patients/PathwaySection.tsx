import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { usePermissions } from "../../../api/identity_access";
import { useClosePathway, useOpenPathway, usePatientPathways, type Pathway } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { formatDate } from "../../../lib/format";
import { CarePlan } from "../../../components/patient/CarePlan";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";
import { MilestoneForm } from "./MilestoneForm";
import { NeedForm } from "./NeedForm";

const MILESTONE_ORDER = ["intake", "review", "final"] as const;

export function PathwaySection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const pathways = usePatientPathways(patientId);
  const canLead = usePermissions().leadPathways;
  const open = useOpenPathway();

  return (
    <section className="rf-section" aria-labelledby="pathway-title">
      <h2 id="pathway-title" className="rf-title">
        {t("pathway.title")}
      </h2>
      <QueryState query={pathways}>
        {(list) => {
          const current = list[0];
          if (!current || current.status === "closed") {
            return (
              <div className="rf-stack">
                <p>
                  {current
                    ? t("pathway.lastClosed", { date: formatDate(current.closed_at ?? "") })
                    : t("pathway.noneOpen")}
                </p>
                {canLead && (
                  <div>
                    <Button onClick={() => open.mutate(patientId)} pending={open.isPending}>
                      {t("pathway.open")}
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
              {canLead && <CoordinatorActions pathway={current} />}
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
  const { t } = useTranslation();
  return (
    <>
      <p>
        <Trans
          i18nKey="pathway.coordination"
          values={{ name: pathway.coordinator_name, date: formatDate(pathway.opened_at) }}
          components={{ strong: <strong /> }}
        />
        {pathway.closed_at ? t("pathway.closedOn", { date: formatDate(pathway.closed_at) }) : ""}
      </p>
      {pathway.milestones.length > 0 && <MilestonesTable milestones={pathway.milestones} />}
      {pathway.milestones.map((m) => (
        <details key={m.kind} className="rf-disclosure">
          <summary>
            {t(`labels.milestone.${m.kind}`)} · {formatDate(m.recorded_at)}
          </summary>
          <div className="rf-disclosure__body">
            <CarePlan goals={m.goal_codes} disciplines={m.discipline_codes} />
          </div>
          <dl className="rf-dl rf-disclosure__body">
            {m.symptoms.length > 0 && (
              <>
                <dt>{t("pathway.symptoms")}</dt>
                <dd>{m.symptoms.map((s) => `${s.name} (${s.intensity})`).join(", ")}</dd>
              </>
            )}
            {m.goals && (
              <>
                <dt>{t("pathway.goals")}</dt>
                <dd>{m.goals}</dd>
              </>
            )}
            {m.plan && (
              <>
                <dt>{t("pathway.plan")}</dt>
                <dd>{m.plan}</dd>
              </>
            )}
            {m.note && (
              <>
                <dt>{t("pathway.note")}</dt>
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
  const { t } = useTranslation();
  const close = useClosePathway();
  const [recording, setRecording] = useState(false);
  const recorded = new Set(pathway.milestones.map((m) => m.kind));
  const next = MILESTONE_ORDER.find((kind) => !recorded.has(kind));

  return (
    <div className="rf-stack">
      {next && !recording && (
        <div>
          <Button onClick={() => setRecording(true)}>{t(`pathway.record.${next}`)}</Button>
        </div>
      )}
      {next && recording && (
        <div className="rf-panel rf-narrow">
          <h3 className="rf-title">{t(`labels.milestone.${next}`)}</h3>
          <MilestoneForm pathwayId={pathway.id} kind={next} onDone={() => setRecording(false)} />
          <div>
            <Button variant="secondary" onClick={() => setRecording(false)}>
              {t("pathway.closeWithoutSaving")}
            </Button>
          </div>
        </div>
      )}
      <div>
        <ConfirmButton
          question={t("pathway.closeQuestion")}
          confirmLabel={t("pathway.close")}
          onConfirm={() => close.mutate(pathway.id)}
          pending={close.isPending}
        >
          {t("pathway.close")}
        </ConfirmButton>
      </div>
    </div>
  );
}
