import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditPage } from "./AuditPage";

const PATIENT = "11111111-2222-3333-4444-555555555555";

const EVENTS = [
  {
    id: "e1",
    occurred_at: "2030-01-10T09:00:00Z",
    actor_id: "u1",
    actor_name: "Jordan Praticien",
    actor_role: "professional",
    action: "message.read.denied",
    patient_id: PATIENT,
  },
  {
    id: "e2",
    occurred_at: "2030-01-10T08:00:00Z",
    actor_id: "u2",
    actor_name: "Sam Accueil",
    actor_role: "secretary",
    action: "patient.read",
    patient_id: PATIENT,
  },
];

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuditPage />
    </QueryClientProvider>,
  );
}

describe("AuditPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists who did what and flags denied attempts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(EVENTS));
    renderPage();

    expect(await screen.findByText("Jordan Praticien")).toBeInTheDocument();
    expect(screen.getAllByText("Refusé")).toHaveLength(1);
    expect(screen.getByText("patient.read")).toBeInTheDocument();
  });

  it("filters by patient and refuses an id that isn't one", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(EVENTS));
    renderPage();
    await screen.findByText("Jordan Praticien");
    const field = screen.getByLabelText("Filtrer par identifiant de patient");

    await userEvent.type(field, "pas-un-id");
    expect(screen.getByText("Cet identifiant n’est pas valide.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrer" })).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, PATIENT);
    await userEvent.click(screen.getByRole("button", { name: "Filtrer" }));

    await vi.waitFor(() => {
      const last = fetch.mock.calls.at(-1)?.[0] as Request;
      expect(last.url).toContain(`patient_id=${PATIENT}`);
    });
  });
});
