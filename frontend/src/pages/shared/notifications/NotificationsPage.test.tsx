import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationsPage } from "./NotificationsPage";

const ME = { id: "u1", email: "alex@example.com", full_name: "Alex Synthetic", role: "patient", discipline: null };

const INBOX = {
  unread: 1,
  items: [
    {
      id: "n1",
      template: "appointment_reminder",
      subject_id: "a1",
      params: { starts_at: "2030-01-10T09:00:00Z", professional_name: "Jordan Praticien" },
      status: "unread",
      sent_at: "2030-01-09T09:00:00Z",
      read_at: null,
    },
    {
      id: "n2",
      template: "appointment_cancelled",
      subject_id: "a2",
      params: { starts_at: "2030-01-03T09:00:00Z", professional_name: "Sam Praticien" },
      status: "read",
      sent_at: "2030-01-02T09:00:00Z",
      read_at: "2030-01-02T10:00:00Z",
    },
  ],
};

function mockApi(inbox: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.url.endsWith("/auth/me")) return Response.json(ME);
    if (request.method === "POST") return new Response(null, { status: 204 });
    return Response.json(inbox);
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationsPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows each notification as a sentence and marks them read", async () => {
    const fetch = mockApi(INBOX);
    renderPage();

    expect(await screen.findByText(/Rappel : rendez-vous le .* avec Jordan Praticien/)).toBeInTheDocument();
    expect(screen.getByText(/annulé\./)).toBeInTheDocument();
    // Only the unread one can be marked; the read one has no button.
    expect(screen.getAllByRole("button", { name: "Marquer comme lue" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    const posted = fetch.mock.calls.map(([input]) => input as Request).filter((r) => r.method === "POST");
    expect(posted[0].url).toMatch(/\/api\/v1\/notifications\/read$/);
  });

  it("says so when there is nothing", async () => {
    mockApi({ unread: 0, items: [] });
    renderPage();

    expect(await screen.findByText("Aucune notification pour l’instant.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tout marquer comme lu" })).not.toBeInTheDocument();
  });
});
