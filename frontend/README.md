# Frontend

Framework not chosen yet (NiceGUI or React). The folders below apply to either.

## Rules

- The frontend gets **all** data from the backend HTTP API (`/api/v1/...`). It never talks to the database or to Supabase directly.
- The API client in `api/` is **generated** from the backend's OpenAPI spec (`GET /openapi.json`). Never edit it by hand; regenerate it when the backend changes.
- No business rules or permission checks here. The backend decides who sees what; pages only display and submit.
- Synthetic data only.

## Layout

```
api/                     generated API client
components/
  layout/                app shell, navigation per role, header
  forms/                 inputs, form wrappers, validation messages
  tables/                data tables, pagination
  feedback/              alerts, loading and empty states
pages/
  public/                login · faq · request_care (ask for a care pathway)
  patient/               home · appointments · pathway · questionnaires · profile
  professional/          home · patients · schedule · pathways (coordinator view) · questionnaires
  secretariat/           home · reception (check-in, waiting room) · appointments · patients · requests
  admin/                 home · users · faq · analytics · audit
```

One folder per page. A component used by one page lives in that page's folder; move it to `components/` once a second page needs it.

## Ownership

| Folder | Owner |
|---|---|
| `pages/patient/`, `pages/public/request_care/` | Téo |
| `pages/professional/` | Hugo |
| `pages/secretariat/` | Victoria |
| `pages/admin/`, `pages/public/login/`, `pages/public/faq/` | Louis |
| `components/`, `api/` | shared: changes need one reviewer from another owner |
