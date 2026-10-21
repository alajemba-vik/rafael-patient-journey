# Frontend

React and TypeScript, built with Vite. Data goes through TanStack Query (caching, loading and error states) and a typed client generated from the backend's OpenAPI schema.

## Run

Needs Node 24. Start the backend first (see the root README), then:

```bash
npm install
npm run dev          # http://localhost:5173, calls the API set in .env.development
```

Point it at another API with `VITE_API_URL=https://… npm run dev`. A deployed build without `VITE_API_URL` calls the API on its own domain.

| Command                                                             | Does                                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run api:generate`                                              | Regenerate `api/schema.d.ts` from the backend. Run it after any backend endpoint or schema change; CI fails if it's out of date. |
| `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` | The checks CI runs.                                                                                                              |

## Rules

- The frontend gets **all** data from the backend HTTP API (`/api/v1/...`). It never talks to the database or to Supabase directly.
- The API client in `api/` is **generated** from the backend's OpenAPI spec (`GET /openapi.json`). Never edit it by hand; regenerate it when the backend changes.
- No business rules or permission checks here. The backend decides who sees what; pages only display and submit.
- Every page starts with `PageHeader` (title and browser tab) and shows its data through `QueryState`, which gives it the loading, empty, error and "not allowed" states for free.
- Page addresses live in `app/paths.ts` only: routes, menus and links all use it. Never type a path in a page.
- Which buttons a role sees is decided in `api/permissions.ts` only. The API still decides and enforces every permission.
- Dates and times entered or compared go through `components/time.ts`, which uses the Institute's clock (Paris), whatever the browser's time zone.
- UI text is in French, written where it's used; repeated vocabulary (statuses, roles, milestones) lives in `components/labels.ts`. Code and comments are in English.
- Synthetic data only.

## Layout

```
main.tsx                 entry point
app/                     app wiring: routes, page addresses (paths.ts), menus per role
theme/                   design tokens and shared styles
api/                     generated API client (schema.d.ts), session, current user
components/
  layout/                app shell, header, login guard
  forms/                 inputs, form wrappers, validation messages
  tables/                data tables, pagination
  feedback/              alerts, loading and empty states
pages/
  public/                login · faq · request_care (ask for a care pathway)
  patient/               home · appointments · pathway · questionnaires
  professional/          home · patients · schedule · pathways (coordinator view) · questionnaires
  secretariat/           home · reception (check-in, waiting room) · appointments · patients · requests
  admin/                 home · users · faq · analytics · audit
```

One folder per page. A component used by one page lives in that page's folder; move it to `components/` once a second page needs it.

## Ownership

| Folder                                                     | Owner                                                |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `pages/patient/`, `pages/public/request_care/`             | Téo                                                  |
| `pages/professional/`                                      | Hugo                                                 |
| `pages/secretariat/`                                       | Victoria                                             |
| `pages/admin/`, `pages/public/login/`, `pages/public/faq/` | Louis                                                |
| `components/`, `api/`                                      | shared: changes need one reviewer from another owner |
