import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Questionnaire } from "../../../api/questionnaires";
import { QuestionnaireForm } from "./QuestionnaireForm";

const QUESTIONNAIRE: Questionnaire = {
  instrument: "quality_of_life",
  title: "Votre qualité de vie ce mois-ci",
  introduction: "Exemple.",
  questions: [
    { id: "energy", text: "Votre niveau d’énergie" },
    { id: "sleep", text: "Votre sommeil" },
  ],
  choices: [
    { value: 0, label: "Mauvais" },
    { value: 4, label: "Bon" },
  ],
};

function renderForm(onSubmitted = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuestionnaireForm questionnaire={QUESTIONNAIRE} onSubmitted={onSubmitted} />
    </QueryClientProvider>,
  );
  return onSubmitted;
}

describe("QuestionnaireForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("can only be sent once every question is answered", async () => {
    renderForm();
    const send = screen.getByRole("button", { name: "Envoyer mes réponses" });

    await userEvent.click(screen.getAllByLabelText("Bon")[0]);

    expect(send).toBeDisabled();
    expect(screen.getByText("1 réponse sur 2")).toBeInTheDocument();
  });

  it("sends the answers and reports the score", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { id: "1", instrument: "quality_of_life", score: 50, submitted_at: "2030-01-01T00:00:00Z" },
          { status: 201 },
        ),
      );
    const onSubmitted = renderForm();

    await userEvent.click(screen.getAllByLabelText("Bon")[0]);
    await userEvent.click(screen.getAllByLabelText("Mauvais")[1]);
    await userEvent.click(screen.getByRole("button", { name: "Envoyer mes réponses" }));

    expect(onSubmitted).toHaveBeenCalledWith(50);
    const request = fetch.mock.calls[0][0] as Request;
    expect(await request.json()).toEqual({ answers: { energy: 4, sleep: 0 } });
  });
});
