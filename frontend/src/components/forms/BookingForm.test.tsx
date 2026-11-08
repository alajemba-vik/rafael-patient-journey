import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "./BookingForm";

const TEAM = [
  { assignment_id: "a1", user_id: "u1", full_name: "Jordan Praticien", role: "professional", discipline: "Yoga" },
];

const AVAILABILITY = {
  day: "2030-01-10",
  minutes: 45,
  busy: [],
  free: [
    { starts_at: "2030-01-10T08:00:00Z", ends_at: "2030-01-10T08:45:00Z" },
    { starts_at: "2030-01-10T13:00:00Z", ends_at: "2030-01-10T13:45:00Z" },
  ],
};

describe("BookingForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("explains a taken slot instead of a generic error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      if (request.url.includes("/availability")) return Response.json(AVAILABILITY);
      return request.method === "GET" ? Response.json(TEAM) : Response.json({ detail: "Overlap" }, { status: 409 });
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BookingForm patientId="p1" />
      </QueryClientProvider>,
    );

    await screen.findByRole("option", { name: "Jordan Praticien · Yoga" });
    await userEvent.selectOptions(screen.getByLabelText("Avec"), "u1");
    await userEvent.clear(screen.getByLabelText("Date"));
    await userEvent.type(screen.getByLabelText("Date"), "2030-01-10");
    await userEvent.type(screen.getByLabelText("Heure"), "10:00");
    await userEvent.click(screen.getByRole("button", { name: "Prendre le rendez-vous" }));

    expect(
      await screen.findByText("Ce créneau n’est pas libre pour le patient ou pour la personne choisie."),
    ).toBeInTheDocument();
  });

  it("offers the practitioner's free times and fills the time from the one chosen", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      return Response.json(request.url.includes("/availability") ? AVAILABILITY : TEAM);
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BookingForm patientId="p1" />
      </QueryClientProvider>,
    );

    await screen.findByRole("option", { name: "Jordan Praticien · Yoga" });
    await userEvent.selectOptions(screen.getByLabelText("Avec"), "u1");
    await userEvent.clear(screen.getByLabelText("Date"));
    await userEvent.type(screen.getByLabelText("Date"), "2030-01-10");
    await userEvent.click(await screen.findByRole("radio", { name: "14 h 00" }));

    expect(screen.getByRole("group", { name: /Après-midi/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Heure")).toHaveValue("14:00");
  });
});
