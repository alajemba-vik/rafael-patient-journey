import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../../api/session";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/connexion", element: <LoginPage /> },
      { path: "/", element: <p>Accueil</p> },
    ],
    { initialEntries: ["/connexion"] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function submit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Adresse e-mail"), email);
  await userEvent.type(screen.getByLabelText("Mot de passe"), password);
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    session.end();
  });

  it("logs in and goes to the home page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ access_token: "tok", token_type: "bearer" }));
    renderLogin();

    await submit("alex@example.com", "synthetic-password-1");

    expect(await screen.findByText("Accueil")).toBeInTheDocument();
    expect(session.getToken()).toBe("tok");
  });

  it("says so when the email or password is wrong", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ detail: "Invalid" }, { status: 401 }));
    renderLogin();

    await submit("alex@example.com", "wrong-password");

    expect(await screen.findByText("E-mail ou mot de passe incorrect.")).toBeInTheDocument();
    expect(session.getToken()).toBeNull();
  });
});
