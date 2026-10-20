import { useState, type FormEvent } from "react";

import { useRecordMilestone, type MilestoneCreate } from "../../../api/pathways";
import { Button } from "../../../components/forms/Button";
import { TextArea } from "../../../components/forms/TextArea";
import { TextField } from "../../../components/forms/TextField";
import { DIMENSIONS } from "../../../components/labels";

type Kind = MilestoneCreate["kind"];
type Scores = Pick<MilestoneCreate, (typeof DIMENSIONS)[number][0]>;
const SCALE = [0, 1, 2, 3, 4];

/** The coordinator records a milestone with the patient: self-assessment, symptoms, goals, plan. */
export function MilestoneForm({ pathwayId, kind, onDone }: { pathwayId: string; kind: Kind; onDone: () => void }) {
  const record = useRecordMilestone();
  const [scores, setScores] = useState<Partial<Scores>>({});
  const [symptoms, setSymptoms] = useState([{ name: "", intensity: 5 }]);
  const [goals, setGoals] = useState("");
  const [plan, setPlan] = useState("");
  const [note, setNote] = useState("");
  const complete = DIMENSIONS.every(([key]) => scores[key] !== undefined);

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
    };
    record.mutate({ pathwayId, body }, { onSuccess: onDone });
  }

  return (
    <form className="rf-form" onSubmit={submit}>
      {/* TODO(validate): what 0 and 4 mean on the Institute's self-assessment scale. */}
      <p className="rf-muted">Auto-évaluation du patient, de 0 à 4, sans justification.</p>
      {DIMENSIONS.map(([key, label]) => (
        <fieldset key={key} className="rf-question">
          <legend>{label}</legend>
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
        <legend>Symptômes et intensité (0 à 10)</legend>
        <div className="rf-stack">
          {symptoms.map((symptom, index) => (
            <div key={index} className="rf-row">
              <TextField
                label={`Symptôme ${index + 1}`}
                value={symptom.name}
                maxLength={120}
                onChange={(event) => setSymptom(index, { name: event.target.value })}
              />
              <TextField
                label="Intensité"
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
              Ajouter un symptôme
            </Button>
          </div>
        </div>
      </fieldset>

      <TextArea label="Attentes et objectifs du patient" value={goals} onChange={(e) => setGoals(e.target.value)} />
      <TextArea label="Soins convenus ensemble" value={plan} onChange={(e) => setPlan(e.target.value)} />
      <TextArea
        label="Note de coordination"
        hint="Visible par l’équipe de soins, pas par le patient."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {record.isError && (
        <p className="rf-field__error" role="alert">
          L’enregistrement n’a pas abouti. Vos saisies sont conservées : réessayez.
        </p>
      )}
      <Button type="submit" pending={record.isPending} disabled={!complete}>
        Enregistrer le bilan
      </Button>
    </form>
  );
}
