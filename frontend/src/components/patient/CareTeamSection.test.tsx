import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../api/core/session";
import { CareTeamSection } from "./CareTeamSection";

const ME = {
  id: "u1",
  email: "c@example.com",
  full_name: "Claire Coordination",
  role: "coordinator",
  discipline: null,
};
const TEAM = [
  {
    assignment_id: "a1",
    user_id: "u2",
    full_name: "Nadia Diététique",
    role: "professional",
    discipline: "Diététique",
    reason: "convocation",
    note: "Bilan nutrition en janvier",
    added_by_name: "Claire Coordination",
    added_at: "2030-01-05T09:00:00Z",
  },
];
const STAFF = [
  { id: "u3", email: "s@example.com", full_name: "Sam Sophrologie", role: "professional", discipline: "Sophrologie" },
];

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.url.endsWith("/auth/me")) return Response.json(ME);
    if (request.method === "POST") return Response.json({ id: "a2", patient_id: "p1", professional_id: "u3" });
    if (request.url.includes("/care-staff")) return Response.json(STAFF);
    return Response.json(TEAM);
  });
}

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CareTeamSection patientId="p1" />
    </QueryClientProvider>,
  );
}

describe("CareTeamSection", () => {
  beforeEach(() => session.start("test-token"));
  afterEach(() => {
    session.end();
    vi.restoreAllMocks();
  });

  it("shows why and by whom each member was given the file", async () => {
    mockApi();
    renderSection();

    expect(await screen.findByText("Pour convocation", { selector: ".rf-chip" })).toBeInTheDocument();
    expect(screen.getByText(/^Ajouté par Claire Coordination le/)).toBeInTheDocument();
    expect(screen.getByText("« Bilan nutrition en janvier »")).toBeInTheDocument();
  });

  it("shares the file with a reason and a note", async () => {
    const fetch = mockApi();
    renderSection();

    await screen.findByRole("option", { name: /Sam Sophrologie/ });
    await userEvent.selectOptions(screen.getByLabelText("Ajouter à l’équipe"), "u3");
    await userEvent.selectOptions(screen.getByLabelText("Motif du partage"), "medical_opinion");
    await userEvent.type(screen.getByLabelText("Note (facultatif)"), "Avis sur le sommeil");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(await post?.clone().json()).toEqual({
      patient_id: "p1",
      professional_id: "u3",
      reason: "medical_opinion",
      note: "Avis sur le sommeil",
    });
  });
});
