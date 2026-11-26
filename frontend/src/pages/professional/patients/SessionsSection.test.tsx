import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../../api/core/session";

import { SessionsSection } from "./SessionsSection";

const ME = {
  id: "coach",
  email: "coach@example.com",
  full_name: "Jordan Coach",
  role: "professional",
  discipline: null,
};

const SESSIONS = [
  {
    appointment_id: "a1",
    starts_at: "2030-01-10T09:00:00Z",
    professional_id: "coach",
    professional_name: "Jordan Coach",
    patient_difficulty: 3,
    patient_satisfaction: 4,
    coping: null,
    intensity_mets: null,
  },
  {
    appointment_id: "a2",
    starts_at: "2030-01-03T09:00:00Z",
    professional_id: "someone-else",
    professional_name: "Sam Sophrologue",
    patient_difficulty: null,
    patient_satisfaction: null,
    coping: 3,
    intensity_mets: null,
  },
];

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionsSection patientId="p1" />
    </QueryClientProvider>,
  );
}

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.url.endsWith("/auth/me")) return Response.json(ME);
    if (request.method === "POST") return Response.json({ ...SESSIONS[0], coping: 3, intensity_mets: 5.5 });
    return Response.json(SESSIONS);
  });
}

describe("SessionsSection", () => {
  // Signed in, so the page knows who "me" is and which sessions are mine to rate.
  beforeEach(() => session.start("test-token"));
  afterEach(() => {
    session.end();
    vi.restoreAllMocks();
  });

  it("shows both sides of each session as words", async () => {
    mockApi();
    renderSection();

    expect(await screen.findByText("Difficile")).toBeInTheDocument();
    expect(screen.getByText("J’ai hâte de revenir")).toBeInTheDocument();
    expect(screen.getByText("À l’aise")).toBeInTheDocument();
  });

  it("lets the practitioner rate only their own session, with an optional intensity", async () => {
    const fetch = mockApi();
    renderSection();

    const rate = await screen.findByRole("button", { name: /^Évaluer la séance du/ });
    expect(screen.getAllByRole("button", { name: /Évaluer|Modifier/ })).toHaveLength(1);
    await userEvent.click(rate);
    await userEvent.click(screen.getByLabelText("À l’aise"));
    await userEvent.type(screen.getByLabelText("Intensité de la séance en MET (facultatif)"), "5,5");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(post?.url).toMatch(/\/sessions\/a1\/practitioner-rating$/);
    expect(await post?.json()).toEqual({ coping: 3, intensity_mets: 5.5 });
  });

  it("refuses an impossible intensity", async () => {
    mockApi();
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: /^Évaluer la séance du/ }));
    await userEvent.click(screen.getByLabelText("À l’aise"));
    await userEvent.type(screen.getByLabelText("Intensité de la séance en MET (facultatif)"), "40");

    expect(screen.getByText("Entre 0,5 et 25.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });
});
