import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../../api/core/session";
import { TasksPage } from "./TasksPage";

const ME = {
  id: "u1",
  email: "c@example.com",
  full_name: "Claire Coordination",
  role: "coordinator",
  discipline: null,
};
const TASK = {
  id: "t1",
  title: "Convocation bilan 3 mois",
  note: null,
  patient_id: "p1",
  patient_name: "Alex Exemple",
  assigned_to: "u1",
  assigned_to_name: "Claire Coordination",
  created_by: "u2",
  created_by_name: "Sam Accueil",
  priority: "high",
  status: "todo",
  due_on: "2020-01-01",
  created_at: "2019-12-20T09:00:00Z",
  done_at: null,
};
const ASSIGNEES = [
  { id: "u1", full_name: "Claire Coordination", role: "coordinator", discipline: null },
  { id: "u3", full_name: "Nadia Diététique", role: "professional", discipline: "Diététique" },
];
const PATIENTS = [{ id: "p1", first_name: "Alex", last_name: "Exemple", birth_date: "1970-01-01" }];

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input as Request;
    const url = request.url;
    if (url.endsWith("/auth/me")) return Response.json(ME);
    if (request.method === "POST" && url.endsWith("/tasks")) return Response.json(TASK, { status: 201 });
    if (request.method === "POST") return Response.json({ ...TASK, status: "in_progress" });
    if (url.includes("/tasks/assignees")) return Response.json(ASSIGNEES);
    if (url.includes("/tasks")) return Response.json(url.includes("given=true") ? [] : [TASK]);
    return Response.json(PATIENTS);
  });
}

function requests(fetch: ReturnType<typeof mockApi>, method: string) {
  return fetch.mock.calls.map(([input]) => input as Request).filter((r) => r.method === method);
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TasksPage />
    </QueryClientProvider>,
  );
}

describe("TasksPage", () => {
  beforeEach(() => session.start("test-token"));
  afterEach(() => {
    session.end();
    vi.restoreAllMocks();
  });

  it("sorts my tasks into lanes and shows who gave them and when they are due", async () => {
    mockApi();
    renderPage();

    const todo = await screen.findByRole("region", { name: /À faire/ });
    expect(await within(todo).findByText("Convocation bilan 3 mois")).toBeInTheDocument();
    expect(within(todo).getByText("Haute")).toBeInTheDocument();
    expect(within(todo).getByText("Sam Accueil")).toBeInTheDocument();
    expect(within(todo).getByText(/en retard/)).toBeInTheDocument();
    expect(screen.getByText("Aucune tâche en cours.")).toBeInTheDocument();
  });

  it("moves a task along with one click", async () => {
    const fetch = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Commencer" }));

    const [post] = requests(fetch, "POST");
    expect(post.url).toMatch(/\/tasks\/t1\/status$/);
    expect(await post.clone().json()).toEqual({ status: "in_progress" });
  });

  it("gives a new task about a patient to a colleague", async () => {
    const fetch = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Nouvelle tâche" }));
    const form = screen.getByRole("form", { name: "Nouvelle tâche" });
    await userEvent.type(within(form).getByLabelText("Tâche"), "Appeler pour l’atelier");
    await within(form).findByRole("option", { name: /Nadia Diététique/ });
    await userEvent.selectOptions(within(form).getByLabelText("Confiée à"), "u3");
    await within(form).findByRole("option", { name: "Exemple Alex" });
    await userEvent.selectOptions(within(form).getByLabelText(/^Patient/), "p1");
    await userEvent.click(within(form).getByRole("button", { name: "Créer la tâche" }));

    const [post] = requests(fetch, "POST");
    expect(await post.clone().json()).toEqual({
      title: "Appeler pour l’atelier",
      note: null,
      assigned_to: "u3",
      patient_id: "p1",
      priority: "medium",
      due_on: null,
    });
  });

  it("does not offer to delete a task someone else created", async () => {
    mockApi();
    renderPage();

    await screen.findByText("Convocation bilan 3 mois");
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
  });
});
