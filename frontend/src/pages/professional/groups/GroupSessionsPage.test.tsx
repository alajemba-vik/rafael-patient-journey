import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session as login } from "../../../api/core/session";
import { GroupSessionsPage } from "./GroupSessionsPage";

const ME = { id: "sec", email: "s@example.com", full_name: "Sam Accueil", role: "secretary", discipline: null };
const SESSION = {
  id: "g1",
  professional_id: "u1",
  professional_name: "Jordan Coach",
  title: "Activité physique adaptée",
  starts_at: "2030-01-10T17:00:00Z",
  ends_at: "2030-01-10T18:00:00Z",
  capacity: 12,
  enrolled: 1,
  status: "scheduled",
};
const DETAIL = {
  ...SESSION,
  participants: [{ patient_id: "p1", patient_name: "Alex Synthetic", status: "enrolled" }],
};
const PATIENTS = [
  {
    id: "p2",
    first_name: "Sam",
    last_name: "Exemple",
    birth_date: "1970-01-01",
    email: null,
    phone: null,
    has_account: false,
  },
];

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    const url = request.url;
    if (url.endsWith("/auth/me")) return Response.json(ME);
    if (url.includes("/care-staff")) return Response.json([]);
    if (request.method === "POST") return Response.json({ ...DETAIL, enrolled: 2 });
    if (url.includes("/patients")) return Response.json(PATIENTS);
    if (url.endsWith("/group-sessions/g1")) return Response.json(DETAIL);
    return Response.json([SESSION]);
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GroupSessionsPage />
    </QueryClientProvider>,
  );
}

describe("GroupSessionsPage", () => {
  beforeEach(() => login.start("test-token"));
  afterEach(() => {
    login.end();
    vi.restoreAllMocks();
  });

  it("lists sessions with their places and opens one to enrol a patient", async () => {
    const fetch = mockApi();
    renderPage();

    expect(await screen.findByText(/1 inscrit\(s\) sur 12 places/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Voir les inscrits/ }));

    const enrolled = await screen.findByRole("list", { name: "Inscrits" });
    expect(within(enrolled).getByText("Alex Synthetic")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Inscrire un patient/), "Sam");
    await userEvent.click(await screen.findByRole("button", { name: "Inscrire Sam Exemple" }));

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(post?.url).toMatch(/\/group-sessions\/g1\/enrollments$/);
    expect(await post?.json()).toEqual({ patient_id: "p2" });
  });

  it("asks reception who leads a new session", async () => {
    mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Nouvelle séance" }));

    const form = screen.getByRole("form", { name: "Planifier une séance collective" });
    expect(within(form).getByLabelText("Animée par")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Planifier" })).toBeDisabled();
  });
});
