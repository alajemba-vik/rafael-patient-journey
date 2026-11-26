# Frontend

React and TypeScript, built with Vite. Data goes through TanStack Query (caching, loading and error states) and a typed client generated from the backend's OpenAPI schema.

## Run

Needs Node 24. The root README's "Run it locally" has both setups: your screens on the live API, or everything on your machine.

```bash
npm install
npm run dev          # http://localhost:5173
```

The API it calls comes from `.env.development` (a local backend at `http://localhost:8000`), unless `.env.development.local` sets another `VITE_API_URL`, e.g. `https://rafael-api.vercel.app`. That file stays on your machine. A deployed build without `VITE_API_URL` calls the API on its own domain.

| Command                                                                                      | Does                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run api:generate`                                                                       | Regenerate `src/api/core/schema.d.ts` from the backend. Run it after any backend endpoint or schema change; CI fails if it's out of date.                          |
| `npm run format:check` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` | The checks CI runs (plus `api:generate` being up to date).                                                                                                         |
| `npm run e2e`                                                                                | Browser tests of whole journeys (`e2e/`), against the real API on a throwaway database. Starts both servers itself. First time: `npx playwright install chromium`. |

## Rules

- The frontend gets **all** data from the backend HTTP API (`/api/v1/...`). It never talks to the database or to Supabase directly.
- The API types in `src/api/core/schema.d.ts` are **generated** from the backend's OpenAPI spec (`GET /openapi.json`). Never edit them by hand; regenerate them when the backend changes.
- `src/api/` has one file per backend module, with the module's name: `backend/app/modules/care_team/` is `src/api/care_team.ts`. A new backend module gets its file here under the same name.
- No business rules or permission checks here. The backend decides who sees what; pages only display and submit.
- Every page starts with `PageHeader` (title and browser tab) and shows its data through `QueryState`, which gives it the loading, empty, error and "not allowed" states for free.
- Page addresses live in `src/app/paths.ts` only: routes, menus and links all use it. Never type a path in a page.
- Which buttons a role sees is decided in `usePermissions` (`src/api/identity_access.ts`) only. The API still decides and enforces every permission.
- Dates and times entered or compared go through `src/lib/time.ts`, which uses the Institute's clock (Paris), whatever the browser's time zone.
- UI text is never written in a page: it lives in `src/i18n/locales/` (French `fr.json`, English `en.json`) and pages show it with `t("…")` from `useTranslation()` (react-i18next). Keys are typed from `fr.json`, so a missing key fails the typecheck, and a test checks every language has the same keys. Repeated vocabulary (statuses, roles, milestones) sits under `labels.*`. French is the default and the fallback. Code and comments are in English.
- Dates and numbers go through `src/lib/format.ts`, which follows the interface's language (still on Paris time).
- Adding a language: add `src/i18n/locales/<code>.json` with every key, and an entry in `LANGUAGES` (`src/i18n/index.ts`). The switcher in the header lists it by itself.
- Synthetic data only.

## Layout

All the source lives in `src/`. (Vercel would treat a top-level `api/` folder as serverless functions.)

```
e2e/                       Playwright browser tests of whole journeys (reception so far)
src/
  main.tsx                 entry point
  app/                     app wiring: routes, page addresses (paths.ts), menus per role
  theme/                   design tokens and shared styles
  api/                     data hooks, one file per backend module (same names)
    core/                  generated API types (schema.d.ts), HTTP client, session, query cache
  i18n/                    translations setup and locale files (fr, en)
  lib/                     non-UI helpers: formatting, Paris time, label keys
    hooks/                 shared React hooks (clock, debounce, page title)
  components/
    layout/                app shell, header, login guard
    forms/                 inputs, buttons, booking form
    appointments/          move, cancel and annotate an appointment; free-slot picker
    tables/                shared tables (milestones)
    feedback/              loading, empty, error and "not allowed" states, status badge
    patient/               patient-file sections shared by portals (care team, appointments)
  pages/
    public/                login · faq · not_found
    patient/               home · appointments · pathway · questionnaires
    professional/          schedule · patients (list and file) · pathways · needs · dashboard
    reception/             board (arrivals, waiting room) · patients
    admin/                 users · faq
```

One folder per page. A component used by one page lives in that page's folder; move it to `components/` once a second page needs it.

## Backend module → frontend

Where to look on this side for each backend module. Pages are grouped by who uses them (the
URLs are per role), and most pages draw on several modules, so this table is the map.

| Backend module (`backend/app/modules/`) | Data hooks (`src/api/`) | Used by                                                                                                                                               |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_access`                       | `identity_access.ts`    | `pages/public/login`, `pages/admin/users`, app shell and menus, `usePermissions` everywhere                                                           |
| `patients`                              | `patients.ts`           | `pages/reception/patients`, `pages/professional/patients`, `pages/admin/users`                                                                        |
| `care_team`                             | `care_team.ts`          | `components/patient` (care team section), `pages/professional/patients`                                                                               |
| `pathways`                              | `pathways.ts`           | `pages/professional/patients`, `pathways`, `needs` · `pages/patient/home`, `pathway`                                                                  |
| `scheduling`                            | `scheduling.ts`         | `components/appointments`, `components/forms` (booking), `pages/reception/board`, `pages/professional/schedule`, `pages/patient/appointments`, `home` |
| `reception`                             | `reception.ts`          | `pages/reception/board`                                                                                                                               |
| `questionnaires`                        | `questionnaires.ts`     | `pages/patient/questionnaires`, `home` · `pages/professional/patients`                                                                                |
| `analytics`                             | `analytics.ts`          | `pages/professional/dashboard` (also shown to admins at `/admin/tableau-de-bord`)                                                                     |
| `faq`                                   | `faq.ts`                | `pages/public/faq`, `pages/admin/faq`                                                                                                                 |
| `notifications`                         | none yet                | none yet                                                                                                                                              |

## Ownership

| Folder                                                | Owner                                                |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `src/pages/patient/`                                  | Téo                                                  |
| `src/pages/professional/`                             | Hugo                                                 |
| `src/pages/reception/`                                | Victoria                                             |
| `src/pages/admin/`, `src/pages/public/`               | Louis                                                |
| `src/components/`, `src/lib/`, `src/api/`, `src/app/` | shared: changes need one reviewer from another owner |
