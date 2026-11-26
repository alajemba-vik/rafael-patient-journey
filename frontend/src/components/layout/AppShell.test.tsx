import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: "/a", element: <Link to="/b">Page suivante</Link> },
          { path: "/b", element: <h1>Page B</h1> },
        ],
      },
    ],
    { initialEntries: ["/a"] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens each new page at the top, with focus on it but without scrolling down", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderShell();

    await userEvent.click(await screen.findByRole("link", { name: "Page suivante" }));

    expect(await screen.findByRole("heading", { name: "Page B" })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });
});
