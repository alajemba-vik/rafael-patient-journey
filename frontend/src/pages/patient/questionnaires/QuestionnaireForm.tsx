import { useState, type FormEvent } from "react";

import type { Questionnaire } from "../../../api/questionnaires";
import { useSubmitQuestionnaire } from "../../../api/questionnaires";
import { Button } from "../../../components/forms/Button";

type Props = { questionnaire: Questionnaire; onSubmitted: (score: number) => void };

export function QuestionnaireForm({ questionnaire, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const submit = useSubmitQuestionnaire();
  const answered = Object.keys(answers).length;
  const total = questionnaire.questions.length;
  const progressPercent = (answered / total) * 100;

  function send(event: FormEvent) {
    event.preventDefault();
    submit.mutate(
      { instrument: questionnaire.instrument, answers },
      { onSuccess: (result) => onSubmitted(result.score) },
    );
  }

  return (
    <form className="rf-form" onSubmit={send} style={{ maxWidth: "640px" }}>
      <p className="rf-lead" style={{ color: "var(--ink-muted)", marginBottom: "var(--space-6)" }}>
        {questionnaire.introduction}
      </p>

      {questionnaire.questions.map((question) => (
        <fieldset
          key={question.id}
          className="rf-question"
          style={{
            background: "var(--surface-raised)",
            padding: "var(--space-5)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 2px 8px rgba(18, 35, 74, 0.02)",
            width: "100%",
          }}
        >
          <legend style={{ fontSize: "18px", marginBottom: "var(--space-4)" }}>{question.text}</legend>
          <div className="rf-choices" style={{ gap: "var(--space-3)" }}>
            {questionnaire.choices.map((choice) => (
              <label key={choice.value} className="rf-choice">
                <input
                  type="radio"
                  name={question.id}
                  value={choice.value}
                  checked={answers[question.id] === choice.value}
                  onChange={() => setAnswers({ ...answers, [question.id]: choice.value })}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {/* Barre de progression visuelle */}
      <div style={{ width: "100%", marginTop: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
          <span className="rf-muted" style={{ fontWeight: 600 }}>
            Votre progression
          </span>
          <span className="rf-muted" aria-live="polite">
            {answered} réponse{answered > 1 ? "s" : ""} sur {total}
          </span>
        </div>
        <div style={{ height: "10px", background: "var(--surface-tint)", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "var(--accent)",
              borderRadius: "999px",
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>

      {submit.isError && (
        <p className="rf-field__error" role="alert">
          L’envoi n’a pas abouti. Vos réponses sont conservées : réessayez.
        </p>
      )}

      <div style={{ marginTop: "var(--space-6)", width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" pending={submit.isPending} disabled={answered < total}>
          Envoyer mes réponses
        </Button>
      </div>
    </form>
  );
}
