import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyGroupSessions } from "./MyGroupSessions";

const SESSION = {
  id: "g1",
  professional_id: "u1",
  professional_name: "Jordan Coach",
  title: "Yoga",
  starts_at: "2030-01-10T17:00:00Z",
  ends_at: "2030-01-10T18:00:00Z",
  capacity: 12,
  enrolled: 5,
  status: "scheduled",
};

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MyGroupSessions />
    </QueryClientProvider>,
  );
}

describe("MyGroupSessions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the classes the patient is enrolled in, not cancelled ones", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json([SESSION, { ...SESSION, id: "g2", title: "Pilates", status: "cancelled" }]),
    );
    renderSection();

    expect(await screen.findByText("Yoga")).toBeInTheDocument();
    expect(screen.queryByText("Pilates")).not.toBeInTheDocument();
  });

  it("shows nothing when the patient has no class", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    renderSection();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Mes séances collectives" })).not.toBeInTheDocument();
  });
});
