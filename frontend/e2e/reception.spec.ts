import { expect, test, type Page } from "@playwright/test";

async function signInAsReception(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("rafael.token", "e2e-secretary"));
}

test.beforeEach(async ({ page }) => {
  await signInAsReception(page);
});

test("reception registers a new patient", async ({ page }) => {
  await page.goto("/accueil/patients");
  await page.getByText("Enregistrer un nouveau patient").click();

  await page.getByLabel("Prénom").fill("Sam");
  await page.getByLabel("Nom", { exact: true }).fill("Exemple");
  await page.getByLabel("Date de naissance").fill("1980-02-03");
  await page.getByLabel("Téléphone (facultatif)").fill("+33 6 00 00 00 01");
  await page.getByRole("button", { name: "Enregistrer le patient" }).click();

  // On cherche simplement le texte, sans forcer le rôle HTML "heading"
  await expect(page.getByText(/Sam Exemple/).first()).toBeVisible();
  await expect(page.getByText("06 00 00 00 01").first()).toBeVisible();
});

test("reception books an appointment and runs the patient's visit on the day's board", async ({ page }) => {
  await page.goto("/accueil/patients");
  await page.getByLabel("Rechercher par nom ou téléphone").fill("Synthetic");
  await page.getByRole("link", { name: /SYNTHETIC Alex/ }).click();

  // On attend un peu que la page charge le bouton
  await page.waitForTimeout(1000);
  await page.getByText("Prendre un rendez-vous").first().click();

  await page.getByLabel("Avec").selectOption({ label: "Jordan Praticien · Yoga" });
  await page.getByLabel("Heure").fill("23:00");
  await page.getByRole("button", { name: "Prendre le rendez-vous" }).click();
  await expect(page.getByText("Rendez-vous enregistré.").first()).toBeVisible();

  await page.goto("/accueil");
  const upcoming = page.getByRole("region", { name: /À venir/ });
  await upcoming.getByRole("button", { name: /^Arrivé·e/ }).click();

  const waiting = page.getByRole("region", { name: /En salle d’attente/ });
  await expect(waiting.getByText("Alex Synthetic").first()).toBeVisible();
  await waiting.getByRole("button", { name: /^Appeler/ }).click();

  const inSession = page.getByRole("region", { name: /En séance/ });
  await expect(inSession.getByText("Alex Synthetic").first()).toBeVisible();
  await inSession.getByRole("button", { name: /^Terminer/ }).click();

  await expect(page.getByText("Terminés · 1").first()).toBeVisible();
});
