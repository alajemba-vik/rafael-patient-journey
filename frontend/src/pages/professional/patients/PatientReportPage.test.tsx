import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientReportPage } from "./PatientReportPage";

const PATIENT = {
  id: "p1",
  first_name: "Camille",
  last_name: "Exemple",
  birth_date: "1970-05-05",
  email: null,
  phone: null,
  user_id: null,
  has_account: false,
  medical_summary: null,
};
const PROFILE = {
  cancer_site: "colorectal",
  treatments: [{ id: "t1", kind: "surgery", status: "finished", started_on: "2029-02-01", ended_on: "2029-02-01" }],
  updated_at: "2030-01-10T09:00:00Z",
  updated_by: "u1",
};
const TEAM = [
  { assignment_id: "a1", user_id: "u1", full_name: "Inès Coordination", role: "coordinator", discipline: null },
];
const PATHWAYS = [
  {
    id: "pw1",
    patient_id: "p1",
    coordinator_id: "u1",
    coordinator_name: "Inès Coordination",
    status: "open",
    opened_at: "2030-01-01T09:00:00Z",
    closed_at: null,
    milestones: [],
  },
];

function mockApi(patient: object) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = (input as Request).url;
    if (url.includes("/clinical-profile")) return Response.json(PROFILE);
    if (url.includes("/care-team/")) return Response.json(TEAM);
    if (url.includes("/assessments") || url.includes("/scores")) return Response.json([]);
    if (url.includes("/pathways/")) return Response.json(PATHWAYS);
    return Response.json(patient);
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/pro/patients/p1/compte-rendu"]}>
        <Routes>
          <Route path="/pro/patients/:patientId/compte-rendu" element={<PatientReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PatientReportPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("puts the patient, their profile and pathway on one printable page", async () => {
    mockApi(PATIENT);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();

    expect(await screen.findByRole("heading", { name: "Compte rendu de parcours" })).toBeInTheDocument();
    expect(screen.getByText("Camille Exemple")).toBeInTheDocument();
    expect(await screen.findByText("Côlon-rectum")).toBeInTheDocument();
    expect(screen.getByText("Chirurgie")).toBeInTheDocument();
    expect(screen.getAllByText("Inès Coordination").length).toBeGreaterThan(0);
    expect(screen.getByText("Aucun bilan enregistré.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Imprimer ou enregistrer en PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("asks for nothing clinical when the person is not in the care team", async () => {
    const administrative = Object.fromEntries(Object.entries(PATIENT).filter(([key]) => key !== "medical_summary"));
    const fetch = mockApi(administrative);
    renderPage();

    expect(await screen.findByText(/Seule l’équipe de soins/)).toBeInTheDocument();
    const urls = fetch.mock.calls.map(([input]) => (input as Request).url);
    expect(urls.some((u) => u.includes("clinical-profile") || u.includes("assessments"))).toBe(false);
  });
});
