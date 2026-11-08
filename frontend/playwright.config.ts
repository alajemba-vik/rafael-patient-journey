import { defineConfig, devices } from "@playwright/test";

// Node's `process`, typed here so the browser app's tsconfig needn't pull in all of @types/node.
declare const process: { env: Record<string, string | undefined> };

// Browser tests of whole journeys, against the real API on a throwaway database
// (backend/tests/e2e/server.py) and the real frontend. `npm run e2e` starts both.
const API_PORT = 8100;
const WEB_PORT = 5180;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false, // one shared database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris", // the Institute's clock, whatever the machine's
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "cd ../backend && uv run python -m tests.e2e.server",
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: WEB_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
