# Frontend

React and TypeScript, built with Vite. Data goes through TanStack Query (caching, loading and error states) and a typed client generated from the backend's OpenAPI schema.

## Run

Needs Node 24. Start the backend first (see the root README), then:

```bash
npm install
npm run dev          # http://localhost:5173, calls the API set in .env.development
```

Point it at another API with `VITE_API_URL=https://… npm run dev`. A deployed build without `VITE_API_URL` calls the API on its own domain.

| Command                                                             | Does                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run api:generate`                                              | Regenerate `src/api/schema.d.ts` from the backend. Run it after any backend endpoint or schema change; CI fails if it's out of date. |
| `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` | The checks CI runs.                                                                                                                  |

## Rules

- The frontend gets **all** data from the backend HTTP API (`/api/v1/...`). It never talks to the database or to Supabase directly.
- The API client in `src/api/` is **generated** from the backend's OpenAPI spec (`GET /openapi.json`). Never edit it by hand; regenerate it when the backend changes.
- No business rules or permission checks here. The backend decides who sees what; pages only display and submit.
- Every page starts with `PageHeader` (title and browser tab) and shows its data through `QueryState`, which gives it the loading, empty, error and "not allowed" states for free.
- Page addresses live in `src/app/paths.ts` only: routes, menus and links all use it. Never type a path in a page.
- Which buttons a role sees is decided in `src/api/permissions.ts` only. The API still decides and enforces every permission.
- Dates and times entered or compared go through `src/components/time.ts`, which uses the Institute's clock (Paris), whatever the browser's time zone.
- UI text is in French, written where it's used; repeated vocabulary (statuses, roles, milestones) lives in `src/components/labels.ts`. Code and comments are in English.
- Synthetic data only.

## Layout

All the source lives in `src/`. (Vercel would treat a top-level `api/` folder as serverless functions.)

```
src/
  main.tsx                 entry point
  app/                     app wiring: routes, page addresses (paths.ts), menus per role
  theme/                   design tokens and shared styles
  api/                     generated API client (schema.d.ts), session, data hooks per area, permissions
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

## Ownership

| Folder                                    | Owner                                                |
| ----------------------------------------- | ---------------------------------------------------- |
| `src/pages/patient/`                      | Téo                                                  |
| `src/pages/professional/`                 | Hugo                                                 |
| `src/pages/secretariat/`                  | Victoria                                             |
| `src/pages/admin/`, `src/pages/public/`   | Louis                                                |
| `src/components/`, `src/api/`, `src/app/` | shared: changes need one reviewer from another owner |
