# AGENTS.md

Rules for everyone working in this repo: people and AI coding agents (Claude Code, Cursor, Codex, Copilot…). Agents: read this whole file before every task and follow it over your own defaults. If a request conflicts with it, stop and say so.

## Project

Patient journey and management platform for Institut Rafaël (integrative post-cancer care) and Institut Hartmann. Users: patients, healthcare professionals, care coordinators, reception (secretariat), admins.

- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, Postgres (Supabase). Python 3.12+, managed with `uv`.
- **Frontend:** React and TypeScript (Vite, TanStack Query, a client generated from the API); see `frontend/README.md`.
- **Data:** synthetic only. Never use, paste or ask for real patient data, in code, tests, prompts or screenshots.

## Repo map

```
backend/app/
  main.py          creates the app; every module's router is already registered (don't edit)
  config.py        settings from .env
  db.py            engine, session, Base: the only place with the connection string
  auth.py          the only code that talks to Supabase Auth
  audit.py         record(db, actor_id, action, patient_id)
  errors.py        NotFoundError, ForbiddenError, UnauthorizedError
  modules/<name>/  one business area each (see below)
backend/migrations/  Alembic: the only way to change tables
backend/tests/<name>/  tests per module
frontend/          pages per role + shared components
```

Modules: `identity_access` (Louis), `patients` (Victoria), `care_team` (Hugo), `pathways` (Hugo), `scheduling` (Victoria), `reception` (Victoria), `questionnaires` (Téo), `analytics`, `faq` (Louis), `notifications`.

Every module already has `router.py`, `schemas.py`, `service.py` and `models.py`. In the modules not started yet, each file's docstring says what belongs there: read it and write the code in that file. Don't create other files or folders for a module's code, and put its tests in `backend/tests/<module>/`.

**Work only in the module or folder your task is about.** Need a change in someone else's module? Say so in the PR or ask; don't edit it in passing.

## Architecture rules (non-negotiable)

1. **Module boundaries.** A module may import another module's `service.py` only, never its `models.py`, `schemas.py` or `router.py`, and never query its tables. Link to other modules' data by id (UUID column), with no cross-module foreign keys.
2. **Logic lives in `service.py`.** Routers parse the request, call one service function and return its result. The frontend only displays and submits.
3. **Permissions = role + care relationship.** Check them in the service, at the top of the function. Professionals and coordinators see clinical data only for patients in their care team (`care_team.service.is_in_care_team`). Reception and admins get administrative data only. Patients see only their own data.
4. **Audit patient data access.** Every read or write of patient data calls `audit.record(...)`, including denied attempts (`"<thing>.<action>.denied"`).
5. **Supabase stays in `db.py` and `auth.py`.** Never import `supabase` anywhere else; never call Supabase from the frontend.
6. **Schema changes only through Alembic migrations.** Never change tables in the Supabase dashboard. Never edit a migration that is already on `main`; add a new one.

## Backend code style

Ruff enforces formatting and lint (`uv run ruff format .` and `uv run ruff check .`). Beyond that:

**Module layout.** Follow `modules/patients/`. Files, in order of who calls whom:

| File | Contains | Must not |
|---|---|---|
| `router.py` | `APIRouter(prefix="/<module>", tags=["<module>"])`, endpoints | contain logic, queries or permission checks |
| `schemas.py` | Pydantic request/response models | import SQLAlchemy |
| `service.py` | business rules, permission checks, queries, audit, commit | import FastAPI (except `identity_access`) |
| `models.py` | SQLAlchemy tables | contain logic |

**Naming.**
- Files, functions, variables: `snake_case`. Classes: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.
- Functions start with a verb: `create_patient`, `list_patients`, `is_in_care_team`.
- Tables: plural snake_case (`patients`, `care_assignments`). Primary key `id: uuid.UUID`.
- Schemas: `<Thing>Create`, `<Thing>Update`, and an output schema per audience (`PatientAdministrative`, `PatientDetail`).
- Audit actions: `"<thing>.<verb>"`, e.g. `"patient.read"`, `"appointment.cancel"`.

**Endpoints.**
- Base `/api/v1/<module>`, plural nouns: `GET /patients`, `GET /patients/{id}`, `POST /patients`, `PATCH /patients/{id}`.
- Actions that aren't plain CRUD use a verb sub-path: `POST /appointments/{id}/check-in`.
- Return types are declared on the function (`-> PatientDetail`); no `response_model=` duplication.
- Status codes: `201` create, `200` read/update, `204` delete, and errors from `app.errors`.

**Typing and functions.**
- Type every parameter and return value. Use `X | None`, not `Optional[X]`.
- Service function signature: `def verb_thing(db: Session, user: CurrentUser, ...) -> Schema`.
- Keep functions short; extract a private `_helper` when a function passes ~30 lines.

**Errors.**
- Services raise `NotFoundError`, `ForbiddenError` or `UnauthorizedError` from `app/errors.py`, never `HTTPException`.
- Don't catch exceptions you can't handle.

**Database.**
- SQLAlchemy 2.0 style only: `Mapped[...]`, `mapped_column`, `select(...)`. No legacy `session.query`.
- No raw SQL strings.
- The service commits once at the end of a write.

**Comments.**
- A docstring on each module and on any non-obvious function, saying *why*, not *what*.
- No commented-out code, and no `print`.

**Dependencies.** Don't add a package without saying why in the PR. Prefer the standard library and what's already installed.

## Tests

- Every service function gets tests for the allowed case **and** each denied role.
- Tests live in `backend/tests/<module>/test_<module>.py`. Name them as sentences: `test_professional_outside_care_team_is_denied`.
- Use the `db` and `client_as(Role.X, user_id)` fixtures from `tests/conftest.py`. They need no Supabase.
- Arrange / act / assert, separated by blank lines. Synthetic names only (e.g. "Alex Synthetic").

## Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "add appointments"   # after changing models.py
# read the generated file, fix anything wrong, commit it with your feature
uv run alembic upgrade head
```

New modules need no registration: any `app/modules/<name>/models.py` is picked up automatically. Louis reviews every migration.

## Frontend style (framework-neutral)

- One folder per page under `pages/<role>/`. Shared pieces go in `components/` once two pages use them.
- Data comes only from the generated client in `api/`. Never hard-code URLs or call `fetch` ad hoc.
- No permission logic. If the API returns 403, show a "not allowed" state.
- Every page handles loading, empty and error states.
- UI text is in French; code and comments are in English.

## Git workflow

- **Branches:** `feat/<module>-<short-name>`, `fix/<module>-<short-name>`, `chore/<short-name>`.
- **Commits** (Conventional Commits): `feat(patients): add patient search`, `fix(auth): handle expired token`, `test(...)`, `docs(...)`, `refactor(...)`, `chore(...)`.
- **PRs:**
  - One feature per PR, ideally under ~400 changed lines.
  - The description says what changed, why, and how it was tested.
  - At least one teammate reviews. Nobody pushes to `main` directly.

## How agents must work

1. **Read first.** This file, then the module you're changing, then `modules/patients/` as the reference.
2. **Plan briefly.** Say which files you'll touch before editing. Stay inside the task's module/folder.
3. **Match the existing code.** Same layout, naming and patterns as `patients`. Don't introduce new patterns, layers, abstractions or libraries unless the task asks for them.
4. **Small diffs.**
   - Don't reformat or "improve" unrelated code.
   - Don't rename things you didn't need to.
   - Don't delete code you don't understand.
5. **Don't invent Institute workflows.** If behaviour depends on how Institut Rafaël works and you don't know, implement the simplest version, mark it `# TODO(validate): <question>`, and list it in your summary.
6. **Never:**
   - touch `.env` or secrets;
   - weaken or skip a permission check, an audit call or a test to make something pass;
   - edit a merged migration;
   - add real data.
7. **Finish with the checks below passing**, then summarise what changed, what you assumed, and any `TODO(validate)` items.

## Definition of done

```bash
cd backend
uv run ruff format .
uv run ruff check .
uv run pytest
```

All three pass, new behaviour has allowed and denied tests, and patient data access is audited.
