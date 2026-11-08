import { expect, test, type Page } from "@playwright/test";

// The reception journey from the brief: register a patient, book an appointment, then run
// the day's arrivals and waiting room. Synthetic data only (see backend/tests/e2e/server.py).

async function signInAsReception(page: Page) {
  // The test API takes the token as the login's identity: no password, no Supabase.
  await page.addInitScript(() => sessionStorage.setItem("rafael.token", "e2e-secretary"));
}

test.beforeEach(async ({ page }) => {
  await signInAsReception(page);
});

test("reception registers a new patient", async ({ page }) => {
  await page.goto("/accueil/patients");

  await page.getByText("Enregistrer un patient").click();
  await page.getByLabel("Prénom").fill("Sam");
  await page.getByLabel("Nom", { exact: true }).fill("Exemple");
  await page.getByLabel("Date de naissance").fill("1980-02-03");
  await page.getByLabel("Téléphone (facultatif)").fill("+33 6 00 00 00 01");
  await page.getByRole("button", { name: "Enregistrer le patient" }).click();

  await expect(page.getByRole("heading", { name: /Sam Exemple/ })).toBeVisible();
  await expect(page.getByText("06 00 00 00 01")).toBeVisible();
});

test("reception books an appointment and runs the patient's visit on the day's board", async ({ page }) => {
  // Book: the patient's file, with their practitioner, today at 23:00 (always still today).
  await page.goto("/accueil/patients");
  await page.getByLabel("Rechercher par nom ou téléphone").fill("Synthetic");
  await page.getByRole("link", { name: /SYNTHETIC Alex/ }).click();
  await page.getByText("Prendre un rendez-vous").click();
  await page.getByLabel("Avec").selectOption({ label: "Jordan Praticien · Yoga" });
  await page.getByLabel("Heure").fill("23:00");
  await page.getByRole("button", { name: "Prendre le rendez-vous" }).click();
  await expect(page.getByText("Rendez-vous enregistré.")).toBeVisible();

  // Arrival, call-in, end of session, each from the card on today's board.
  await page.goto("/accueil");
  const upcoming = page.getByRole("region", { name: "À venir" });
  await upcoming.getByRole("button", { name: /^Arrivé·e/ }).click();

  const waiting = page.getByRole("region", { name: "En salle d’attente" });
  await expect(waiting.getByRole("link", { name: "Alex Synthetic" })).toBeVisible();
  await waiting.getByRole("button", { name: /^Appeler/ }).click();

  const inSession = page.getByRole("region", { name: "En séance" });
  await expect(inSession.getByRole("link", { name: "Alex Synthetic" })).toBeVisible();
  await inSession.getByRole("button", { name: /^Terminer/ }).click();

  await expect(page.getByText("Terminés · 1")).toBeVisible();
  await expect(page.getByRole("region", { name: "En séance" }).getByText("Aucune séance en cours.")).toBeVisible();
});
