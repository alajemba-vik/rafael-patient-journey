import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useRateSessionAsPatient, useSessionsToRate, type Session } from "../../../api/questionnaires";
import { Button } from "../../../components/forms/Button";
import { LevelChoice } from "../../../components/forms/LevelChoice";
import { formatDate } from "../../../lib/format";
import { levelLabels } from "../../../lib/sessionLevels";

function RateOne({ session }: { session: Session }) {
  const { t } = useTranslation();
  const rate = useRateSessionAsPatient();
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);

  return (
    <form
      className="rf-panel rf-stack"
      aria-label={t("sessions.rateFormLabel", { name: session.professional_name, date: formatDate(session.starts_at) })}
      onSubmit={(event) => {
        event.preventDefault();
        if (difficulty === null || satisfaction === null) return;
        rate.mutate({ appointmentId: session.appointment_id, difficulty, satisfaction });
      }}
    >
      <p className="rf-title">
        {t("sessions.sessionWith", { name: session.professional_name, date: formatDate(session.starts_at) })}
      </p>
      <LevelChoice
        legend={t("sessions.difficultyQuestion")}
        labels={levelLabels("difficulty")}
        value={difficulty}
        onChange={setDifficulty}
      />
      <LevelChoice
        legend={t("sessions.satisfactionQuestion")}
        labels={levelLabels("satisfaction")}
        value={satisfaction}
        onChange={setSatisfaction}
      />
      {rate.isError && <p className="rf-field__error">{t("sessions.rateError")}</p>}
      <div>
        <Button type="submit" pending={rate.isPending} disabled={difficulty === null || satisfaction === null}>
          {t("sessions.send")}
        </Button>
      </div>
    </form>
  );
}

/** Recent sessions the patient hasn't rated yet. Nothing is shown when there are none. */
export function RateSessions() {
  const { t } = useTranslation();
  const sessions = useSessionsToRate();
  if (!sessions.data || sessions.data.length === 0) return null;

  return (
    <section className="rf-section rf-stack" aria-labelledby="rate-title">
      <h2 id="rate-title" className="rf-title">
        {t("sessions.toRateTitle")}
      </h2>
      <p className="rf-muted">{t("sessions.toRateIntro")}</p>
      {sessions.data.map((session) => (
        <RateOne key={session.appointment_id} session={session} />
      ))}
    </section>
  );
}
