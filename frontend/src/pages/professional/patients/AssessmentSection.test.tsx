import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssessmentSection } from "./AssessmentSection";

const SCORES = [
  {
    kind: "intake",
    test: "k10",
    value: 27,
    band: "moderate",
    recorded_by_name: "Nadia Psychologue",
    recorded_at: "2030-01-10T09:00:00Z",
  },
  {
    kind: "review",
    test: "k10",
    value: 18,
    band: "well",
    recorded_by_name: "Nadia Psychologue",
    recorded_at: "2030-04-10T09:00:00Z",
  },
];

const PATHWAYS = [
  {
    id: "pw1",
    patient_id: "p1",
    coordinator_id: "c1",
    coordinator_name: "Inès Coordination",
    status: "open",
    opened_at: "2030-01-01T09:00:00Z",
    closed_at: null,
    milestones: [],
  },
];

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "POST") return Response.json({ ...SCORES[0], test: "marshall", value: 6, band: null });
    if (request.url.includes("/assessments")) return Response.json(SCORES);
    return Response.json(PATHWAYS);
  });
}

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AssessmentSection patientId="p1" />
    </QueryClientProvider>,
  );
}

describe("AssessmentSection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows each test's score and what it means, step by step", async () => {
    mockApi();
    renderSection();

    const row = await screen.findByRole("row", { name: /Détresse psychologique/ });
    expect(within(row).getByText("27")).toBeInTheDocument();
    expect(within(row).getByText("Modéré")).toBeInTheDocument();
    expect(within(row).getByText("Probablement en bonne santé")).toBeInTheDocument();
  });

  it("records a test within its range", async () => {
    const fetch = mockApi();
    renderSection();

    const form = await screen.findByRole("form", { name: "Saisir un résultat" });
    await userEvent.selectOptions(within(form).getByLabelText("Test"), "marshall");
    const value = within(form).getByLabelText("Résultat");
    await userEvent.type(value, "12");
    expect(within(form).getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    await userEvent.clear(value);
    await userEvent.type(value, "6");
    await userEvent.click(within(form).getByRole("button", { name: "Enregistrer" }));

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(post?.url).toMatch(/\/pathways\/pw1\/assessments$/);
    expect(await post?.json()).toEqual({ kind: "intake", test: "marshall", value: 6 });
  });
});
