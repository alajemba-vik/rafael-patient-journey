import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RateSessions } from "./RateSessions";

const SESSION = {
  appointment_id: "a1",
  starts_at: "2030-01-10T09:00:00Z",
  professional_id: "u1",
  professional_name: "Jordan Coach",
  patient_difficulty: null,
  patient_satisfaction: null,
  coping: null,
  intensity_mets: null,
};

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RateSessions />
    </QueryClientProvider>,
  );
}

describe("RateSessions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks the two questions and sends both answers", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      return request.method === "POST"
        ? Response.json({ ...SESSION, patient_difficulty: 2, patient_satisfaction: 4 })
        : Response.json([SESSION]);
    });
    renderSection();

    const form = await screen.findByRole("form", { name: /Évaluer la séance du .* avec Jordan Coach/ });
    const send = within(form).getByRole("button", { name: "Envoyer mon avis" });
    expect(send).toBeDisabled();

    await userEvent.click(within(form).getByLabelText("Adaptée"));
    await userEvent.click(within(form).getByLabelText("J’ai hâte de revenir"));
    await userEvent.click(send);

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(post?.url).toMatch(/\/sessions\/a1\/patient-rating$/);
    expect(await post?.json()).toEqual({ difficulty: 2, satisfaction: 4 });
  });

  it("shows nothing when every session is rated", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    renderSection();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Vos séances à évaluer" })).not.toBeInTheDocument();
  });
});
