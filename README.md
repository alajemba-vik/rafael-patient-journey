# Rafaël Patient Journey

Digital patient journey and management platform for Institut Rafaël: patient, practitioner, coordinator, reception and admin interfaces on one shared backend. The brief plans shared use with Institut Hartmann; the code doesn't separate the two institutes yet.

```
Browser → frontend (pages per role) → backend API /api/v1 → Postgres (Supabase)
```

- The frontend only talks to the API.
- The API holds all business rules and permissions.
- Supabase is only touched in `backend/app/db.py` and `backend/app/auth.py`.

## Run it locally

Two ways, depending on what you change.

| You change… | Use | You need |
|---|---|---|
| Only screens (pages, buttons, text) | **A. Your screens on the live API** | Node 24 |
| The backend (endpoints, rules, a module's `service.py`) | **B. Everything on your machine** | Node 24, [uv](https://docs.astral.sh/uv/), the values for `backend/.env` |

Your login is the same in both: the live and local setups share one Supabase project. Ask the database admin (Victoria) for an account if you don't have one.

### A. Your screens on the live API

1. In `frontend/`, create a file named exactly `.env.development.local` with one line:
   ```
   VITE_API_URL=https://rafael-api.vercel.app
   ```
   It stays on your machine (Git ignores it) and overrides `.env.development`, which points at a local backend.
2. Start the screens:
   ```bash
   cd frontend
   npm install
   npm run dev                    # http://localhost:5173
   ```
3. Log in.

Everything you create or change this way lands in the shared live data, which the whole team sees. Synthetic data only.

This works because the live API's `CORS_ORIGINS` on Vercel includes `http://localhost:5173`. Delete `.env.development.local` to go back to a local backend.

### B. Everything on your machine

1. Get the values for `backend/.env` from the database admin, **in a private message**. They give full access to the database: never post them in a group chat, an issue or a commit.
2. Copy `.env.example` (at the root of the repo) to `backend/.env` and paste the values into `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. On Windows, check the file is named `.env` and not `.env.txt`.
3. **Terminal 1**, the backend:
   ```bash
   cd backend
   uv sync
   uv run alembic upgrade head    # create/update tables
   uv run fastapi dev app/main.py # http://localhost:8000/docs
   ```
   Check http://localhost:8000/api/v1/health shows `{"status":"ok"}`.
4. **Terminal 2**, the screens (keep terminal 1 running):
   ```bash
   cd frontend
   npm install
   npm run dev                    # http://localhost:5173
   ```
5. Log in.

### When it doesn't work

| You see | It means | Fix |
|---|---|---|
| "Connexion impossible pour le moment", and the browser console shows `ERR_CONNECTION_REFUSED` on `:8000` | The screens call a local backend that isn't running | Start the backend (B, step 3), or set up A |
| A console error mentioning `CORS` or `Access-Control-Allow-Origin` | The API doesn't accept your screens' address | Use `http://localhost:5173` exactly; the database admin checks `CORS_ORIGINS` on Vercel |
| The health page shows `"database":"unreachable"` | Supabase has paused the database (free plan, after a quiet week) or `DATABASE_URL` is wrong | Tell the database admin, who restores it in the Supabase dashboard |
| "E-mail ou mot de passe incorrect" | The setup works; the account or password is wrong | Ask the database admin |

### Checks

Backend: `uv run ruff format . && uv run ruff check . && uv run pytest`. Tests need no Supabase or `.env`.

Frontend: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`, and `npm run e2e` when a journey changed. After any backend API change, `npm run api:generate` refreshes the typed client. More in `frontend/README.md`.

CI (`.github/workflows/ci.yml`) runs the same checks on every pull request into `main` and on every push to `main`. It also applies the migrations to a fresh Postgres and fails if `models.py` changed without a migration (`alembic check`).

### Demo data

Synthetic patients, practitioners, care teams and a week of appointments, with today's
spread around the moment you run it (some finished, some in session, some waiting, some
late, some still to come):

```bash
cd backend
uv run python -m scripts.seed_demo --yes                       # replace the demo data
uv run python -m scripts.seed_demo --yes --attach you@example.org  # also give your practitioner/coordinator login sessions today
uv run python -m scripts.seed_demo --remove --yes              # remove the demo data only
```

Demo rows use `@demo.rafael.invalid` emails and staff accounts that cannot log in; nothing
else is touched. Never run it against a database holding real patients.

### First login

1. Create the first admin by hand: in Supabase → Authentication → Users, add the person, then add a matching row in `users` with their Supabase user id as `auth_subject` and the role `admin`.
2. `POST /api/v1/auth/login` returns a token. In `/docs`, click **Authorize** and paste it.
3. From then on, the admin creates every other account with `POST /api/v1/auth/users` (needs `SUPABASE_SECRET_KEY` in `.env`).

## Deploy (Vercel)

Two Vercel projects from this repository:

| Project | Framework | Root Directory | Environment variables |
|---|---|---|---|
| API | FastAPI | `backend` | the values from `backend/.env`, with `CORS_ORIGINS=["https://<frontend>.vercel.app","http://localhost:5173"]` (the second lets local screens use the live API) |
| App | Vite | `frontend` | `VITE_API_URL=https://<api>.vercel.app` |

`backend/vercel.json` runs the API in Frankfurt, next to the Supabase database; `frontend/vercel.json` sends every page address to the app so links and refreshes work. Run `uv run alembic upgrade head` against the database before deploying a new migration.

## Repo layout

```
backend/
  app/
    main.py  config.py  db.py  auth.py  audit.py  errors.py
    modules/            one folder per business area, each with router/schemas/service/models;
                        patients/ is the reference
  migrations/           Alembic schema history
  tests/
frontend/               React app: pages per role + shared components (see frontend/README.md)
AGENTS.md               code guidelines and rules for people and AI agents
```

| Module | Owns | Owner | Status |
|---|---|---|---|
| `identity_access` | users, roles, login | Louis | login, admin account creation |
| `patients` | patient profiles | Victoria | reference module |
| `care_team` | who cares for which patient | Hugo | assign, remove, list team |
| `pathways` | ~6-month care pathway, reviews | Hugo | open, milestones, close, patient and coordinator views |
| `scheduling` | appointments and their status | Victoria | book from free slots, move, cancel with a reason, team notes, double-booking blocked in the database |
| `reception` | check-in, waiting room | Victoria | any day's board, arrivals, waiting and session times, no-shows, undo |
| `questionnaires` | questionnaires and answers | Téo | monthly quality of life, end-of-pathway satisfaction, scores |
| `analytics` | de-identified indicators | no owner yet | patient-experience dashboard |
| `faq` | FAQ content | Louis | public read, admin editing |
| `notifications` | reminders, emails | no owner yet | files ready, not started |

**Database admin: Victoria** (migrations, Supabase, data rules in the database, demo data).

## Team rules

Full details are in [AGENTS.md](AGENTS.md).

1. One folder per module. Use another module only through its `service.py`.
2. Rules and permission checks live in the backend service, never the frontend.
3. Permissions combine **role + care relationship**, with tests for the denied cases.
4. Reading or changing patient data is recorded with `audit.record`.
5. Tables change only through Alembic migrations; the database admin (Victoria) reviews them.
6. **Synthetic data only.** No real patient data until HDS-certified hosting, a DPIA (data protection impact assessment) and access rules are approved.
