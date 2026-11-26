import { useTranslation } from "react-i18next";

import type { Discipline, Goal } from "../../lib/carePlan";

/** A milestone's care plan: the patient's goals and the disciplines chosen to reach them. */
export function CarePlan({ goals, disciplines }: { goals: Goal[]; disciplines: string[] }) {
  const { t } = useTranslation();
  if (goals.length === 0 && disciplines.length === 0) return null;
  return (
    <dl className="rf-dl">
      {goals.length > 0 && (
        <>
          <dt>{t("carePlan.goalsTitle")}</dt>
          <dd>
            <ul className="rf-chips">
              {goals.map((goal) => (
                <li key={goal} className="rf-chip">
                  {t(`carePlan.goals.${goal}`)}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {disciplines.length > 0 && (
        <>
          <dt>{t("carePlan.disciplinesTitle")}</dt>
          <dd>
            <ul className="rf-chips">
              {disciplines.map((code) => (
                <li key={code} className="rf-chip">
                  {t(`carePlan.disciplines.${code as Discipline}`)}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
    </dl>
  );
}
