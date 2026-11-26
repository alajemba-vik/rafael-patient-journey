import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/core/client";
import { PatientMessagesPage } from "./PatientMessagesPage";

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientMessagesPage />
    </QueryClientProvider>,
  );
}

describe("PatientMessagesPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads the patient's own conversation and says where emergencies go", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    renderPage();

    expect(screen.getByRole("heading", { name: "Messages" })).toBeInTheDocument();
    expect(screen.getByText(/appelez le 15/)).toBeInTheDocument();
    await screen.findByText("Aucun message pour l’instant.");
    expect((fetch.mock.calls[0][0] as Request).url).toMatch(/\/api\/v1\/pathways\/messages\/mine$/);
  });

  it("shows the error state when the conversation can't load", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new ApiError(500, "down");
    });
    renderPage();

    expect(await screen.findByRole("button", { name: /Réessayer/ })).toBeInTheDocument();
  });
});
