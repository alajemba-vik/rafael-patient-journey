import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Appointment } from "../../api/scheduling";
import { ManageAppointment } from "./ManageAppointment";

const APPOINTMENT = {
  id: "ap1",
  patient_id: "p1",
  patient_name: "Alex Synthetic",
  professional_id: "u1",
  professional_name: "Jordan Praticien",
  starts_at: "2030-01-10T08:00:00Z",
  ends_at: "2030-01-10T08:45:00Z",
  status: "scheduled",
  arrived_at: null,
  called_in_at: null,
  cancel_reason: null,
  note: null,
} as Appointment;

function renderManage(appointment: Appointment = APPOINTMENT) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ManageAppointment appointment={appointment} />
    </QueryClientProvider>,
  );
}

describe("ManageAppointment", () => {
  afterEach(() => vi.restoreAllMocks());

  it("cancels with the reason chosen", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(APPOINTMENT));
    renderManage();

    await userEvent.click(screen.getByRole("button", { name: /^Annuler/ }));
    await userEvent.click(screen.getByLabelText(/indisponible/i));
    await userEvent.click(screen.getByRole("button", { name: "Annuler le rendez-vous" }));

    const request = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.url.endsWith("/cancel"));
    expect(await request?.json()).toEqual({ reason: "practitioner_unavailable" });
  });

  it("only offers a note once the appointment has started", () => {
    renderManage({ ...APPOINTMENT, status: "arrived" });

    expect(screen.queryByRole("button", { name: /^Déplacer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Annuler/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Ajouter une note/ })).toBeInTheDocument();
  });
});
