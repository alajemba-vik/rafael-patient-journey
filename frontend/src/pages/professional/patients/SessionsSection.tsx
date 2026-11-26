import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMe } from "../../../api/identity_access";
import { usePatientSessions, useRateSessionAsPractitioner, type Session } from "../../../api/questionnaires";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { LevelChoice } from "../../../components/forms/LevelChoice";
import { TextField } from "../../../components/forms/TextField";
import { formatDate, formatNumber } from "../../../lib/format";
import { levelLabel, levelLabels } from "../../../lib/sessionLevels";

function PractitionerRatingForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const { t } = useTranslation();
  const rate = useRateSessionAsPractitioner();
  const [coping, setCoping] = useState<number | null>(session.coping);
  const [mets, setMets] = useState(session.intensity_mets?.toString() ?? "");
  const metsValue = mets.trim() === "" ? null : Number(mets.replace(",", "."));
  const metsInvalid = metsValue !== null && (Number.isNaN(metsValue) || metsValue < 0.5 || metsValue > 25);

  return (
    <form
      className="rf-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (coping === null || metsInvalid) return;
        rate.mutate(
          { appointmentId: session.appointment_id, coping, intensity_mets: metsValue },
          { onSuccess: onDone },
        );
      }}
    >
      <LevelChoice
        legend={t("sessions.copingQuestion")}
        labels={levelLabels("coping")}
        value={coping}
        onChange={setCoping}
      />
      <TextField
        label={t("sessions.metsLabel")}
        hint={t("sessions.metsHint")}
        inputMode="decimal"
        value={mets}
        onChange={(event) => setMets(event.target.value)}
        error={metsInvalid ? t("sessions.metsError") : undefined}
      />
      {rate.isError && <p className="rf-field__error">{t("sessions.rateError")}</p>}
      <div>
        <Button type="submit" pending={rate.isPending} disabled={coping === null || metsInvalid}>
          {t("sessions.save")}
        </Button>
      </div>
    </form>
  );
}

/** Finished sessions with the patient's and the practitioner's ratings side by side. */
export function SessionsSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const sessions = usePatientSessions(patientId);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="rf-panel rf-section" aria-labelledby="sessions-title">
      <h2 id="sessions-title" className="rf-title">
        {t("sessions.title")}
      </h2>
      <QueryState query={sessions} empty={{ isEmpty: (list) => list.length === 0, title: t("sessions.empty") }}>
        {(list) => (
          <ul className="rf-list">
            {list.map((session) => {
              const mine = me?.id === session.professional_id;
              return (
                <li key={session.appointment_id} className="rf-stack">
                  <p>
                    <strong>{formatDate(session.starts_at)}</strong> · {session.professional_name}
                  </p>
                  <dl className="rf-dl">
                    <dt>{t("sessions.patientDifficulty")}</dt>
                    <dd>{levelLabel("difficulty", session.patient_difficulty)}</dd>
                    <dt>{t("sessions.patientSatisfaction")}</dt>
                    <dd>{levelLabel("satisfaction", session.patient_satisfaction)}</dd>
                    <dt>{t("sessions.coping")}</dt>
                    <dd>{levelLabel("coping", session.coping)}</dd>
                    <dt>{t("sessions.mets")}</dt>
                    <dd>{session.intensity_mets === null ? "—" : formatNumber(session.intensity_mets)}</dd>
                  </dl>
                  {mine &&
                    (editing === session.appointment_id ? (
                      <PractitionerRatingForm session={session} onDone={() => setEditing(null)} />
                    ) : (
                      <div>
                        <Button variant="secondary" onClick={() => setEditing(session.appointment_id)}>
                          {session.coping === null
                            ? t("sessions.rate", { date: formatDate(session.starts_at) })
                            : t("sessions.edit", { date: formatDate(session.starts_at) })}
                        </Button>
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
