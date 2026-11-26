import { useState } from "react";
import { useTranslation } from "react-i18next";

import { TextField } from "../../../components/forms/TextField";
import { DISCIPLINES, GOALS, MAX_DISCIPLINES, MAX_GOALS, type Goal } from "../../../lib/carePlan";

type Props = {
  goals: Goal[];
  disciplines: string[];
  onGoalsChange: (goals: Goal[]) => void;
  onDisciplinesChange: (disciplines: string[]) => void;
};

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
}

/** Up to three goals from the Institute's list and up to five disciplines from its catalogue. */
export function CarePlanFields({ goals, disciplines, onGoalsChange, onDisciplinesChange }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const shown = DISCIPLINES.filter((code) =>
    t(`carePlan.disciplines.${code}`).toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <fieldset className="rf-question">
        <legend>{t("carePlan.goalsLegend", { count: MAX_GOALS })}</legend>
        <div className="rf-choices">
          {GOALS.map((goal) => (
            <label key={goal} className="rf-choice">
              <input
                type="checkbox"
                checked={goals.includes(goal)}
                disabled={!goals.includes(goal) && goals.length >= MAX_GOALS}
                onChange={() => onGoalsChange(toggle(goals, goal))}
              />
              <span>{t(`carePlan.goals.${goal}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="rf-question">
        <legend>{t("carePlan.disciplinesLegend", { count: MAX_DISCIPLINES })}</legend>
        <p className="rf-muted" aria-live="polite">
          {t("carePlan.chosen", { count: disciplines.length, max: MAX_DISCIPLINES })}
        </p>
        <TextField label={t("carePlan.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="rf-choices rf-choices--scroll">
          {shown.map((code) => (
            <label key={code} className="rf-choice">
              <input
                type="checkbox"
                checked={disciplines.includes(code)}
                disabled={!disciplines.includes(code) && disciplines.length >= MAX_DISCIPLINES}
                onChange={() => onDisciplinesChange(toggle(disciplines, code))}
              />
              <span>{t(`carePlan.disciplines.${code}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
