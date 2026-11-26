import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallBacksPage } from "./CallBacksPage";

const CALL_BACKS = [
  {
    patient_id: "p1",
    patient_name: "Alex Synthetic",
    phone: "0612345678",
    missed: 2,
    last_missed_at: "2030-01-08T09:00:00Z",
    next_appointment_at: null,
  },
  {
    patient_id: "p2",
    patient_name: "Sam Exemple",
    phone: null,
    missed: 1,
    last_missed_at: "2030-01-05T09:00:00Z",
    next_appointment_at: "2030-01-15T13:00:00Z",
  },
];

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CallBacksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CallBacksPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists who to call, with a call button and whether anything is booked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(CALL_BACKS));
    renderPage();

    expect(await screen.findByText("2 absences")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeler Alex Synthetic" })).toHaveAttribute("href", "tel:0612345678");
    expect(screen.getByText(/Aucun rendez-vous prévu/)).toBeInTheDocument();
    expect(screen.getByText("Pas de téléphone enregistré")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fiche de Sam Exemple" })).toHaveAttribute("href", "/accueil/patients/p2");
  });

  it("says so when nobody needs a call", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    renderPage();

    expect(await screen.findByText("Personne à rappeler.")).toBeInTheDocument();
  });

  it("exports the list as a spreadsheet file", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(CALL_BACKS));
    let saved: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Exporter (Excel)" }));

    expect(click).toHaveBeenCalled();
    const text = await saved!.text();
    expect(text).toContain("Patient;Téléphone;Absences;Dernière absence;Prochain rendez-vous");
    expect(text).toContain("Alex Synthetic;06 12 34 56 78;2;");
    expect(text).toContain("Rien de prévu");
  });
});
