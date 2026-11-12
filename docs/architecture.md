# Architecture

How the platform is cut up and why. The day-to-day rules (naming, tests, git) are in
[AGENTS.md](../AGENTS.md); this document explains the structure those rules protect.
System architect: Louis.

## One picture

```
Browser
  └─ frontend/            React pages per role. Displays and submits, decides nothing.
       └─ src/api/        typed client generated from the API's OpenAPI schema
            │  HTTPS, bearer token
            ▼
     backend  /api/v1     FastAPI. Every rule and every permission lives here.
       ├─ modules/<name>/ router → service → models   (one business area each)
       ├─ auth.py         the only code that talks to the identity provider (Supabase Auth)
       ├─ audit.py        the audit trail
       └─ db.py           the only code that knows the connection string
            ▼
     Postgres (Supabase)  tables changed only by Alembic migrations; row-level security on,
                          with no policies, so only the backend can read them
```

Three decisions follow from this picture:

1. **The frontend never talks to Supabase.** If it did, permissions would have to be written
   twice (API and database policies) and would drift apart.
2. **Supabase is behind two files.** Changing identity provider or host, which HDS-certified
   hosting will require before real patient data, means rewriting `auth.py` and `db.py` only.
3. **A modular monolith, not services.** Four people and one database: separate deployments
   would add network calls and failure modes without buying anything.

## Modules and who may call whom

A module is one folder with four files. `service.py` is its public API: the only file another
module may import. Tables are private; other modules hold ids (plain UUID columns, no foreign
keys across modules), so a module can change its tables without breaking the others.
`backend/tests/test_architecture.py` fails the build when a module imports another module's
`models`, `schemas` or `router`.

| Module | Owner | Calls the service of |
|---|---|---|
| `identity_access` | Louis | nothing: everyone depends on it, it depends on no module |
| `faq` | Louis | `identity_access` |
| `care_team` | Hugo | `identity_access` |
| `patients` | Victoria | `identity_access`, `care_team` |
| `scheduling` | Victoria | `identity_access`, `care_team`, `patients` |
| `reception` | Victoria | `identity_access`, `scheduling` |
| `pathways` | Hugo | `identity_access`, `care_team`, `patients` |
| `questionnaires` | Téo | `identity_access`, `care_team`, `patients`, `pathways` |
| `analytics` | no owner yet | `identity_access`, `pathways`, `questionnaires`, `scheduling` |
| `notifications` | no owner yet | not started |

Dependencies point one way: `identity_access` → `care_team` → `patients` → the rest →
`analytics`. Keep it that way. A module low in this list must not import one above it (for
example `identity_access` cannot ask `patients` for a name), because Python cannot load two
modules that import each other. When a low module needs data from a higher one, the higher one
passes it in, or the frontend combines two calls.

## API contract

- The contract is the OpenAPI schema FastAPI generates from the routers and the Pydantic
  schemas. Nobody writes it by hand.
- The frontend's types (`frontend/src/api/core/schema.d.ts`) are generated from it with
  `npm run api:generate`; CI fails when they are out of date. A backend change that breaks a
  screen therefore fails the frontend typecheck in the same pull request.
- Everything is under `/api/v1/<module>`. URL and status-code conventions are in AGENTS.md.
- One output schema per audience (`PatientAdministrative`, `PatientDetail`): what a role may
  see is decided by which schema the service returns, never by hiding fields in the frontend.
- Errors are `{"detail": "<message>"}` with the status from `app/errors.py`. A 401 ends the
  session in the frontend; a 403 shows a "not allowed" state.

## Access model

Every request goes through `get_current_user`, which checks the token with the identity
provider's public keys, finds the account in `users`, and refuses unknown and deactivated
accounts. Services then decide with **role + care relationship**:

| Role | Sees |
|---|---|
| patient | their own record only |
| professional | clinical data of patients in their care team |
| coordinator | the same, plus administrative data of patients with no coordinator yet |
| secretary (reception) | administrative data of every patient, nothing clinical |
| admin | administrative data, accounts, the FAQ; nothing clinical |

Admins create every account, change staff roles and deactivate logins. An account is never
deleted: the audit trail and past sessions still point to it. A patient login never becomes a
staff login or the reverse, because a patient login is linked to a patient record.

## Audit trail

Every read or write of patient data, denied attempts included, adds a row to `audit_events`
(who, what, which patient, when) in the same transaction as the work it describes. In Postgres
a trigger refuses any update, and any delete during the first year. Account changes are
recorded too (`user.create`, `user.update`). Admins search the trail by patient or by account
at `/admin/journal`; each look is itself recorded (`audit.read`).

## Shared code and reviews

`app/main.py`, `db.py`, `auth.py`, `audit.py`, `errors.py`, `observability.py`, the frontend's
`api/core/`, `app/`, `components/`, `lib/` and `theme/` belong to everyone, so a change there
needs a reviewer from another area; the architect reviews changes to the backend shared files
and to module boundaries. Migrations are reviewed by the database admin (Victoria).

## Known limits

- **One institute.** The brief plans shared use with Institut Hartmann; no table carries an
  institute id yet. Adding one later touches every module's tables and queries.
- **Synthetic data only**, until HDS-certified hosting, a DPIA and approved access rules.
- **The audit screen shows the newest 200 events** for the chosen filters, with no paging.
- **No password reset in the app**: an admin deactivates the login and creates a new one, or
  resets it in the identity provider.
- **`notifications` is not started**, and `analytics` and `notifications` have no owner.
