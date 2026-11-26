import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useRecordMilestone, type MilestoneCreate } from "../../../api/pathways";
import { Button } from "../../../components/forms/Button";
import { TextArea } from "../../../components/forms/TextArea";
import { TextField } from "../../../components/forms/TextField";
import type { Goal } from "../../../lib/carePlan";
import { DIMENSIONS } from "../../../lib/labels";
import { CarePlanFields } from "./CarePlanFields";

type Kind = MilestoneCreate["kind"];
type Scores = Pick<MilestoneCreate, (typeof DIMENSIONS)[number]>;
const SCALE = [0, 1, 2, 3, 4];

/** The coordinator records a milestone with the patient: self-assessment, symptoms, goals, plan. */
export function MilestoneForm({ pathwayId, kind, onDone }: { pathwayId: string; kind: Kind; onDone: () => void }) {
  const { t } = useTranslation();
  const record = useRecordMilestone();
  const [scores, setScores] = useState<Partial<Scores>>({});
  const [symptoms, setSymptoms] = useState([{ name: "", intensity: 5 }]);
  const [goals, setGoals] = useState("");
  const [plan, setPlan] = useState("");
  const [note, setNote] = useState("");
  const [goalCodes, setGoalCodes] = useState<Goal[]>([]);
  const [disciplineCodes, setDisciplineCodes] = useState<string[]>([]);
  const complete = DIMENSIONS.every((key) => scores[key] !== undefined);

  function setSymptom(index: number, change: Partial<(typeof symptoms)[number]>) {
    setSymptoms(symptoms.map((s, i) => (i === index ? { ...s, ...change } : s)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = {
      kind,
      ...(scores as Scores),
      symptoms: symptoms.filter((s) => s.name.trim() !== "").map((s) => ({ ...s, name: s.name.trim() })),
      goals,
      plan,
      note,
      goal_codes: goalCodes,
      discipline_codes: disciplineCodes,
    };
    record.mutate({ pathwayId, body }, { onSuccess: onDone });
  }

  return (
    <form className="rf-form" onSubmit={submit}>
      <p className="rf-muted">{t("milestoneForm.intro")}</p>
      {DIMENSIONS.map((key) => (
        <fieldset key={key} className="rf-question">
          <legend>{t(`labels.dimension.${key}`)}</legend>
          <div className="rf-choices">
            {SCALE.map((value) => (
              <label key={value} className="rf-choice">
                <input
                  type="radio"
                  name={key}
                  checked={scores[key] === value}
                  onChange={() => setScores({ ...scores, [key]: value })}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="rf-question">
        <legend>{t("milestoneForm.symptoms")}</legend>
        <div className="rf-stack">
          {symptoms.map((symptom, index) => (
            <div key={index} className="rf-row">
              <TextField
                label={t("milestoneForm.symptom", { number: index + 1 })}
                value={symptom.name}
                maxLength={120}
                onChange={(event) => setSymptom(index, { name: event.target.value })}
              />
              <TextField
                label={t("milestoneForm.intensity")}
                type="number"
                min={0}
                max={10}
                value={symptom.intensity}
                onChange={(event) => setSymptom(index, { intensity: Number(event.target.value) })}
              />
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={() => setSymptoms([...symptoms, { name: "", intensity: 5 }])}>
              {t("milestoneForm.addSymptom")}
            </Button>
          </div>
        </div>
      </fieldset>

      <CarePlanFields
        goals={goalCodes}
        disciplines={disciplineCodes}
        onGoalsChange={setGoalCodes}
        onDisciplinesChange={setDisciplineCodes}
      />
      <TextArea label={t("milestoneForm.goals")} value={goals} onChange={(e) => setGoals(e.target.value)} />
      <TextArea label={t("milestoneForm.plan")} value={plan} onChange={(e) => setPlan(e.target.value)} />
      <TextArea
        label={t("milestoneForm.note")}
        hint={t("milestoneForm.noteHint")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {record.isError && (
        <p className="rf-field__error" role="alert">
          {t("milestoneForm.failed")}
        </p>
      )}
      <Button type="submit" pending={record.isPending} disabled={!complete}>
        {t("milestoneForm.submit")}
      </Button>
    </form>
  );
}
