import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageThread } from "./MessageThread";

const THREAD = [
  {
    id: "m1",
    patient_id: "p1",
    sender_id: "u-patient",
    sender_name: "Alex Synthetic",
    from_patient: true,
    body: "Puis-je décaler ma séance ?",
    sent_at: "2030-01-10T09:00:00Z",
  },
  {
    id: "m2",
    patient_id: "p1",
    sender_id: "u-pro",
    sender_name: "Jordan Praticien",
    from_patient: false,
    body: "Oui, bien sûr.",
    sent_at: "2030-01-10T10:00:00Z",
  },
];

function renderThread(asPatient: boolean) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageThread patientId={asPatient ? null : "p1"} asPatient={asPatient} />
    </QueryClientProvider>,
  );
}

describe("MessageThread", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the patient their own messages as theirs and the team's with a name", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(THREAD));
    renderThread(true);

    const thread = await screen.findByRole("list", { name: "Conversation" });
    const [first, second] = within(thread).getAllByRole("listitem");
    expect(within(first).getByText(/^Vous ·/)).toBeInTheDocument();
    expect(within(second).getByText(/^Jordan Praticien ·/)).toBeInTheDocument();
  });

  it("sends a message to the patient's thread and clears the box", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input as Request;
      return request.method === "POST" ? Response.json(THREAD[1], { status: 201 }) : Response.json([]);
    });
    renderThread(false);

    expect(await screen.findByText("Aucun message pour l’instant.")).toBeInTheDocument();
    const box = screen.getByLabelText("Votre message au patient");
    await userEvent.type(box, "Bonjour Alex");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    const post = fetch.mock.calls.map(([input]) => input as Request).find((r) => r.method === "POST");
    expect(post?.url).toMatch(/\/api\/v1\/pathways\/patients\/p1\/messages$/);
    expect(await post?.json()).toEqual({ body: "Bonjour Alex" });
    expect(box).toHaveValue("");
  });

  it("does not send an empty message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json([]));
    renderThread(true);

    await screen.findByText("Aucun message pour l’instant.");
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });
});
