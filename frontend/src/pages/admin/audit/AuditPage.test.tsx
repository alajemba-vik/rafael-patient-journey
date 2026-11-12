import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditPage } from "./AuditPage";

const PATIENT = { id: "11111111-aaaa-bbbb-cccc-000000000000", first_name: "Alex", last_name: "Synthetic" };
const EVENT = {
  id: "e1",
  occurred_at: "2026-11-12T09:30:00Z",
  actor_id: "u1",
  actor_name: "Morgan Accueil",
  action: "patient.read",
  patient_id: PATIENT.id,
};

/** Serve events, accounts and patient search; record every address the page calls. */
function renderPage() {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = (input as Request).url;
    calls.push(url);
    if (url.includes("/audit-events")) return Response.json([EVENT]);
    if (url.includes("/patients")) return Response.json([PATIENT]);
    return Response.json([]);
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuditPage />
    </QueryClientProvider>,
  );
  return calls;
}

describe("AuditPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows recent events without listing patients", async () => {
    const calls = renderPage();

    expect(await screen.findByText("patient.read")).toBeInTheDocument();
    expect(screen.getByText("Morgan Accueil")).toBeInTheDocument();
    expect(screen.getByText("Dossier 11111111")).toBeInTheDocument();
    expect(calls.some((url) => url.includes("/patients"))).toBe(false);
  });

  it("filters on a patient found by name and then shows that name", async () => {
    const calls = renderPage();

    await userEvent.type(screen.getByLabelText("Rechercher un patient"), "syn");
    await screen.findByRole("option", { name: "SYNTHETIC Alex" });
    await userEvent.selectOptions(screen.getByLabelText("Patient"), PATIENT.id);

    expect(await screen.findByRole("cell", { name: "Alex Synthetic" })).toBeInTheDocument();
    expect(calls.some((url) => url.includes(`patient_id=${PATIENT.id}`))).toBe(true);
  });
});
