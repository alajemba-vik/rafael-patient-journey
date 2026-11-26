import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bodyMassIndex } from "../../../lib/clinicalProfile";
import { ClinicalProfileSection } from "./ClinicalProfileSection";

const EMPTY = { treatments: [], updated_at: null, updated_by: null };
const FILLED = {
  cancer_site: "breast",
  diagnosed_on: "2029-03-01",
  metastatic: false,
  height_cm: 170,
  weight_kg: 65,
  occupation: "Enseignante",
  work_situation: "sick_leave",
  drinks_alcohol: true,
  drinks_per_week: 2,
  treatments: [
    {
      id: "t1",
      kind: "chemotherapy",
      status: "finished",
      started_on: "2029-04-01",
      ended_on: "2029-08-01",
      details: null,
    },
  ],
  updated_at: "2030-01-10T09:00:00Z",
  updated_by: "u1",
};

function mockApi(profile: object) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "PUT") return Response.json({ ...FILLED, ...(await request.clone().json()) });
    return Response.json(profile);
  });
}

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ClinicalProfileSection patientId="p1" />
    </QueryClientProvider>,
  );
}

describe("ClinicalProfileSection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the disease, treatments and habits in words", async () => {
    mockApi(FILLED);
    renderSection();

    expect(await screen.findByText("Sein")).toBeInTheDocument();
    expect(screen.getByText("Arrêt maladie")).toBeInTheDocument();
    expect(screen.getByText(/2 verres par semaine/)).toBeInTheDocument();
    expect(screen.getByText("Chimiothérapie")).toBeInTheDocument();
    expect(screen.getByText(/IMC 22,5/)).toBeInTheDocument();
  });

  it("fills an empty profile with a treatment and saves it all at once", async () => {
    const fetch = mockApi(EMPTY);
    renderSection();

    expect(await screen.findByText("Le profil clinique n’a pas encore été rempli.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remplir le profil" }));
    const form = screen.getByRole("form", { name: "Modifier le profil" });
    await userEvent.selectOptions(within(form).getByLabelText("Localisation du cancer"), "lung");
    await userEvent.type(within(form).getByLabelText("Taille (cm)"), "1m70");
    expect(within(form).getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await userEvent.clear(within(form).getByLabelText("Taille (cm)"));
    await userEvent.type(within(form).getByLabelText("Taille (cm)"), "170");
    await userEvent.click(within(form).getByRole("button", { name: "Ajouter un traitement" }));
    await userEvent.selectOptions(within(form).getByLabelText("Type"), "radiotherapy");
    await userEvent.click(within(form).getByRole("button", { name: "Enregistrer" }));

    const put = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "PUT");
    expect(put?.url).toMatch(/\/patients\/p1\/clinical-profile$/);
    const body = await put?.json();
    expect(body.cancer_site).toBe("lung");
    expect(body.height_cm).toBe(170);
    expect(body.weight_kg).toBeNull();
    expect(body.treatments).toEqual([{ kind: "radiotherapy", status: "ongoing" }]);
  });

  it("works out the body mass index only when both measures are known", () => {
    expect(bodyMassIndex(170, 65)).toBe(22.5);
    expect(bodyMassIndex(null, 65)).toBeNull();
  });
});
