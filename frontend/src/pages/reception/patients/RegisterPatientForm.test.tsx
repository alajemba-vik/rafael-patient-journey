import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterPatientForm } from "./RegisterPatientForm";

const EXISTING = {
  id: "p1",
  first_name: "Alex",
  last_name: "Synthetic",
  birth_date: "1970-05-04",
  email: null,
  phone: null,
};

describe("RegisterPatientForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("points to the existing record of a likely duplicate and can still register on purpose", async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      if (request.method === "GET") return Response.json([EXISTING]);
      const body = await request.json();
      bodies.push(body);
      return body.allow_duplicate
        ? Response.json({ ...EXISTING, id: "p2" }, { status: 201 })
        : Response.json({ detail: "Duplicate" }, { status: 409 });
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RegisterPatientForm />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText("Prénom"), "alex");
    await userEvent.type(screen.getByLabelText("Nom"), "Synthetic");
    await userEvent.type(screen.getByLabelText("Date de naissance"), "1970-05-04");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le patient" }));

    expect(await screen.findByRole("link", { name: /Ouvrir la fiche de Alex Synthetic/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /enregistrer quand même/ }));
    expect(bodies.map((b) => (b as { allow_duplicate: boolean }).allow_duplicate)).toEqual([false, true]);
  });
});
