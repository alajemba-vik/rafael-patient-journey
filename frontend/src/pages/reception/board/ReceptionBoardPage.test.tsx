import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReceptionBoardPage } from "./ReceptionBoardPage";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const BASE = {
  patient_id: "p1",
  professional_id: "u1",
  professional_name: "Jordan Praticien",
  called_in_at: null,
  cancel_reason: null,
  note: null,
};

const BOARD = [
  {
    ...BASE,
    id: "a1",
    patient_name: "Alex Synthetic",
    starts_at: minutesAgo(10),
    ends_at: minutesAgo(-35),
    status: "arrived",
    arrived_at: minutesAgo(20),
  },
  {
    ...BASE,
    id: "a2",
    patient_name: "Sam Exemple",
    starts_at: minutesAgo(-120),
    ends_at: minutesAgo(-165),
    status: "scheduled",
    arrived_at: null,
  },
];

function renderBoard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ReceptionBoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReceptionBoardPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows who is waiting, for how long, and calls them in", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      return Response.json(request.method === "GET" ? BOARD : { ...BOARD[0], status: "in_session" });
    });
    renderBoard();

    const waiting = await screen.findByRole("region", { name: "En salle d’attente" });
    expect(within(waiting).getByText("Alex Synthetic")).toBeInTheDocument();
    expect(within(waiting).getByText("Attend depuis 20 min")).toBeInTheDocument();
    const upcoming = screen.getByRole("region", { name: "À venir" });
    // Not started yet: arrival can be recorded, a no-show cannot.
    expect(within(upcoming).getByRole("button", { name: /^Arrivé·e/ })).toBeInTheDocument();
    expect(within(upcoming).queryByRole("button", { name: /^Absent·e/ })).not.toBeInTheDocument();

    // Undoing an arrival is there, but tucked away from the main step.
    expect(within(waiting).queryByRole("button", { name: /^Annuler l’arrivée/ })).not.toBeInTheDocument();
    await userEvent.click(within(waiting).getByRole("button", { name: /^Plus d’options/ }));
    expect(within(waiting).getByRole("button", { name: /^Annuler l’arrivée/ })).toBeInTheDocument();

    await userEvent.click(within(waiting).getByRole("button", { name: /^Appeler/ }));

    const sent = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method !== "GET");
    expect(await sent?.json()).toEqual({ status: "in_session" });
  });
});
