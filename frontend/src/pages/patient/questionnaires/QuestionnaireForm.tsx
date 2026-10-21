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

  function send(event: FormEvent) {
    event.preventDefault();
    submit.mutate(
      { instrument: questionnaire.instrument, answers },
      { onSuccess: (result) => onSubmitted(result.score) },
    );
  }

  return (
    <form className="rf-form" onSubmit={send}>
      <p>{questionnaire.introduction}</p>
      {questionnaire.questions.map((question) => (
        <fieldset key={question.id} className="rf-question">
          <legend>{question.text}</legend>
          <div className="rf-choices">
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
      {submit.isError && (
        <p className="rf-field__error" role="alert">
          L’envoi n’a pas abouti. Vos réponses sont conservées : réessayez.
        </p>
      )}
      <p className="rf-muted" aria-live="polite">
        {answered} réponse{answered > 1 ? "s" : ""} sur {total}
      </p>
      <Button type="submit" pending={submit.isPending} disabled={answered < total}>
        Envoyer mes réponses
      </Button>
    </form>
  );
}
