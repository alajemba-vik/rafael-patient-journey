import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "./BookingForm";

const TEAM = [
  { assignment_id: "a1", user_id: "u1", full_name: "Jordan Praticien", role: "professional", discipline: "Yoga" },
];

describe("BookingForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("explains a taken slot instead of a generic error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      return request.method === "GET"
        ? Response.json(TEAM)
        : Response.json({ detail: "Overlap" }, { status: 409 });
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BookingForm patientId="p1" />
      </QueryClientProvider>,
    );

    await screen.findByRole("option", { name: "Jordan Praticien · Yoga" });
    await userEvent.selectOptions(screen.getByLabelText("Avec"), "u1");
    await userEvent.type(screen.getByLabelText("Date"), "2030-01-10");
    await userEvent.type(screen.getByLabelText("Heure"), "10:00");
    await userEvent.click(screen.getByRole("button", { name: "Prendre le rendez-vous" }));

    expect(
      await screen.findByText("Ce créneau n’est pas libre pour le patient ou pour la personne choisie."),
    ).toBeInTheDocument();
  });
});
