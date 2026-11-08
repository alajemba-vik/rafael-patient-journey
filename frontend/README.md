# Frontend

React and TypeScript, built with Vite. Data goes through TanStack Query (caching, loading and error states) and a typed client generated from the backend's OpenAPI schema.

## Run

Needs Node 24. Start the backend first (see the root README), then:

```bash
npm install
npm run dev          # http://localhost:5173, calls the API set in .env.development
```

Point it at another API with `VITE_API_URL=https://… npm run dev`. A deployed build without `VITE_API_URL` calls the API on its own domain.

| Command                                                             | Does                                                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run api:generate`                                              | Regenerate `src/api/core/schema.d.ts` from the backend. Run it after any backend endpoint or schema change; CI fails if it's out of date.                          |
| `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` | The checks CI runs.                                                                                                                                                |
| `npm run e2e`                                                       | Browser tests of whole journeys (`e2e/`), against the real API on a throwaway database. Starts both servers itself. First time: `npx playwright install chromium`. |

## Rules

- The frontend gets **all** data from the backend HTTP API (`/api/v1/...`). It never talks to the database or to Supabase directly.
- The API types in `src/api/core/schema.d.ts` are **generated** from the backend's OpenAPI spec (`GET /openapi.json`). Never edit them by hand; regenerate them when the backend changes.
- `src/api/` has one file per backend module, with the module's name: `backend/app/modules/care_team/` is `src/api/care_team.ts`. A new backend module gets its file here under the same name.
- No business rules or permission checks here. The backend decides who sees what; pages only display and submit.
- Every page starts with `PageHeader` (title and browser tab) and shows its data through `QueryState`, which gives it the loading, empty, error and "not allowed" states for free.
- Page addresses live in `src/app/paths.ts` only: routes, menus and links all use it. Never type a path in a page.
- Which buttons a role sees is decided in `usePermissions` (`src/api/identity_access.ts`) only. The API still decides and enforces every permission.
- Dates and times entered or compared go through `src/lib/time.ts`, which uses the Institute's clock (Paris), whatever the browser's time zone.
- UI text is in French, written where it's used; repeated vocabulary (statuses, roles, milestones) lives in `src/lib/labels.ts`. Code and comments are in English.
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
  lib/                     non-UI helpers: formatting, Paris time, French labels
    hooks/                 shared React hooks (clock, debounce, page title)
  components/
    layout/                app shell, header, login guard
    forms/                 inputs, buttons, booking form
    tables/                shared tables (milestones)
    feedback/              loading, empty, error and "not allowed" states, status badge
    patient/               patient-file sections shared by portals (care team, appointments)
  pages/
    public/                login · faq · not_found
    patient/               home · appointments · pathway · questionnaires
    professional/          schedule · patients (list and file) · pathways · needs · dashboard
    secretariat/           reception · patients
    admin/                 users · faq
```

One folder per page. A component used by one page lives in that page's folder; move it to `components/` once a second page needs it.

## Backend module → frontend

Where to look on this side for each backend module. Pages are grouped by who uses them (the
URLs are per role), and most pages draw on several modules, so this table is the map.

| Backend module (`backend/app/modules/`) | Data hooks (`src/api/`) | Used by                                                                                                                                                     |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_access`                       | `identity_access.ts`    | `pages/public/login`, `pages/admin/users`, app shell and menus, `usePermissions` everywhere                                                                 |
| `patients`                              | `patients.ts`           | `pages/secretariat/patients`, `pages/professional/patients`, `pages/admin/users`                                                                            |
| `care_team`                             | `care_team.ts`          | `components/patient` (care team section), `pages/professional/patients`                                                                                     |
| `pathways`                              | `pathways.ts`           | `pages/professional/patients`, `pathways`, `needs` · `pages/patient/home`, `pathway`                                                                        |
| `scheduling`                            | `scheduling.ts`         | `components/appointments`, `components/forms` (booking), `pages/secretariat/reception`, `pages/professional/schedule`, `pages/patient/appointments`, `home` |
| `reception`                             | `reception.ts`          | `pages/secretariat/reception`                                                                                                                               |
| `questionnaires`                        | `questionnaires.ts`     | `pages/patient/questionnaires`, `home` · `pages/professional/patients`                                                                                      |
| `analytics`                             | `analytics.ts`          | `pages/professional/dashboard`                                                                                                                              |
| `faq`                                   | `faq.ts`                | `pages/public/faq`, `pages/admin/faq`                                                                                                                       |
| `notifications`                         | none yet                | none yet                                                                                                                                                    |

## Ownership

| Folder                                                | Owner                                                |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `src/pages/patient/`                                  | Téo                                                  |
| `src/pages/professional/`                             | Hugo                                                 |
| `src/pages/secretariat/`                              | Victoria                                             |
| `src/pages/admin/`, `src/pages/public/`               | Louis                                                |
| `src/components/`, `src/lib/`, `src/api/`, `src/app/` | shared: changes need one reviewer from another owner |
