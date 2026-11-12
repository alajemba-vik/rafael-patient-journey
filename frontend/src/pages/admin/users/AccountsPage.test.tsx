import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountsPage } from "./AccountsPage";

const STAFF = {
  id: "u1",
  email: "alex@example.com",
  full_name: "Alex Synthetic",
  role: "professional",
  discipline: null,
  is_active: true,
};

/** Serve the accounts list and record what the page sends to change an account. */
function mockApi() {
  const changes: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method !== "PATCH") return Response.json(request.url.includes("/auth/users") ? [STAFF] : []);
    const body = await request.json();
    changes.push(body);
    return Response.json({ ...STAFF, ...body });
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountsPage />
    </QueryClientProvider>,
  );
  return changes;
}

describe("AccountsPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("changes a staff account's role", async () => {
    const changes = mockApi();

    await userEvent.selectOptions(await screen.findByLabelText("Rôle de Alex Synthetic"), "coordinator");

    expect(changes).toEqual([{ role: "coordinator" }]);
  });

  it("deactivates an account only after confirming", async () => {
    const changes = mockApi();

    await userEvent.click(await screen.findByRole("button", { name: /Désactiver.*Alex Synthetic/ }));
    expect(changes).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Désactiver" }));

    expect(changes).toEqual([{ is_active: false }]);
  });
});
