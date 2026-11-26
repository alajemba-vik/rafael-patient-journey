import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { addDays, instituteToday, mondayOf } from "../../lib/time";
import { WeekPlanning } from "./WeekPlanning";

const STAFF = [
  { id: "u1", email: "a@example.com", full_name: "Jordan Coach", role: "professional", discipline: "APA" },
  { id: "u2", email: "b@example.com", full_name: "Sam Sophro", role: "professional", discipline: "Sophrologie" },
];
const MONDAY = mondayOf(instituteToday());

const SLOTS = [
  {
    id: "a1",
    professional_id: "u1",
    professional_name: "Jordan Coach",
    starts_at: `${MONDAY}T08:00:00Z`,
    ends_at: `${MONDAY}T08:45:00Z`,
    status: "scheduled",
    patient_id: "p1",
    patient_name: "Alex Synthetic",
  },
  {
    id: "a2",
    professional_id: "u1",
    professional_name: "Jordan Coach",
    starts_at: `${addDays(MONDAY, 2)}T10:00:00Z`,
    ends_at: `${addDays(MONDAY, 2)}T10:45:00Z`,
    status: "scheduled",
    patient_id: null,
    patient_name: null,
  },
];

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    return Response.json(request.url.includes("/care-staff") ? STAFF : SLOTS);
  });
}

function renderPlanning() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WeekPlanning />
    </QueryClientProvider>,
  );
}

describe("WeekPlanning", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks who to show before loading anything", async () => {
    const fetch = mockApi();
    renderPlanning();

    expect(await screen.findByLabelText(/Jordan Coach/)).toBeInTheDocument();
    expect(screen.getByText("Choisissez au moins une personne à gauche.")).toBeInTheDocument();
    expect(fetch.mock.calls.some(([input]) => (input as Request).url.includes("/planning"))).toBe(false);
  });

  it("shows the chosen person's week, one row per person, hiding patients outside one's teams", async () => {
    const fetch = mockApi();
    renderPlanning();

    await userEvent.click(await screen.findByLabelText(/Jordan Coach/));

    const row = await screen.findByRole("row", { name: /Jordan Coach/ });
    expect(within(row).getByText("Alex Synthetic")).toBeInTheDocument();
    expect(within(row).getByText("Occupé")).toBeInTheDocument();
    expect(within(row).getAllByText("Libre")).toHaveLength(3);
    const request = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.url.includes("/planning"));
    expect(request?.url).toContain(`monday=${MONDAY}`);
    expect(request?.url).toContain("professional_ids=u1");
  });

  it("moves a week at a time", async () => {
    const fetch = mockApi();
    renderPlanning();
    await userEvent.click(await screen.findByLabelText(/Jordan Coach/));
    await screen.findByRole("row", { name: /Jordan Coach/ });

    await userEvent.click(screen.getByRole("button", { name: /Semaine suivante/ }));

    await vi.waitFor(() => {
      const last = fetch.mock.calls.at(-1)?.[0] as Request;
      expect(last.url).toContain(`monday=${addDays(MONDAY, 7)}`);
    });
  });
});
