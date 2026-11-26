import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../../api/core/session";
import { StaffHomePage } from "./StaffHomePage";

const COORDINATOR = { id: "u1", email: "c@example.com", full_name: "Claire Coordination", role: "coordinator" };
const APPOINTMENT = {
  id: "a1",
  patient_id: "p1",
  patient_name: "Alex Exemple",
  professional_id: "u1",
  professional_name: "Claire Coordination",
  starts_at: "2030-01-10T09:30:00Z",
  ends_at: "2030-01-10T10:00:00Z",
  status: "scheduled",
};
const TASKS = [
  { id: "t1", title: "Convocation bilan", patient_name: "Alex Exemple", status: "todo", due_on: null },
  { id: "t2", title: "Déjà fait", patient_name: null, status: "done", due_on: null },
];

function mockApi(me: object) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = (input as Request).url;
    if (url.endsWith("/auth/me")) return Response.json(me);
    if (url.includes("/appointments/mine")) return Response.json([APPOINTMENT]);
    if (url.includes("/tasks")) return Response.json(TASKS);
    if (url.includes("/notifications")) return Response.json({ unread: 3, items: [] });
    if (url.includes("/needs")) return Response.json([{ id: "n1" }, { id: "n2" }]);
    return Response.json([]);
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StaffHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StaffHomePage", () => {
  beforeEach(() => session.start("test-token"));
  afterEach(() => {
    session.end();
    vi.restoreAllMocks();
  });

  it("gathers today's sessions, open tasks and what came in", async () => {
    mockApi(COORDINATOR);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Bonjour Claire Coordination" })).toBeInTheDocument();
    const today = screen.getByRole("region", { name: "Aujourd’hui" });
    expect(await within(today).findByRole("link", { name: "Alex Exemple" })).toHaveAttribute(
      "href",
      "/pro/patients/p1",
    );
    const tasks = screen.getByRole("region", { name: "Mes tâches" });
    expect(await within(tasks).findByText("1 tâche à faire ou en cours :")).toBeInTheDocument();
    expect(within(tasks).queryByText("Déjà fait")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "3 notifications non lues" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "2 besoins signalés en attente" })).toBeInTheDocument();
  });

  it("does not ask for flagged needs for a practitioner", async () => {
    const fetch = mockApi({ ...COORDINATOR, role: "professional" });
    renderPage();

    await screen.findByRole("link", { name: "3 notifications non lues" });
    const urls = fetch.mock.calls.map(([input]) => (input as Request).url);
    expect(urls.some((u) => u.includes("/needs"))).toBe(false);
  });
});
