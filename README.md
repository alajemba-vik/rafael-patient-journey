# Rafaël Patient Journey

Digital patient journey and management platform for Institut Rafaël and Institut Hartmann: patient, professional, secretariat and admin interfaces on one shared backend.

```
Browser → frontend (pages per role) → backend API /api/v1 → Postgres (Supabase)
```

- The frontend only talks to the API.
- The API holds all business rules and permissions.
- Supabase is only touched in `backend/app/db.py` and `backend/app/auth.py`.

## Run the backend

Requires [uv](https://docs.astral.sh/uv/).

```bash
cd backend
cp ../.env.example .env        # fill in your Supabase values
uv sync
uv run alembic upgrade head    # create/update tables
uv run fastapi dev app/main.py # http://localhost:8000/docs
```

Run checks: `uv run ruff format . && uv run ruff check . && uv run pytest`. Tests need no Supabase or `.env`.

CI (`.github/workflows/ci.yml`) runs the same checks on every pull request, and also applies the migrations to a fresh Postgres and fails if `models.py` changed without a migration (`alembic check`).

### First login

1. Create the first admin by hand: in Supabase → Authentication → Users, add the person, then add a matching row in `users` with their Supabase user id as `auth_subject` and the role `admin`.
2. `POST /api/v1/auth/login` returns a token. In `/docs`, click **Authorize** and paste it.
3. From then on, the admin creates every other account with `POST /api/v1/auth/users` (needs `SUPABASE_SECRET_KEY` in `.env`).

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
| `scheduling` | appointments and their status | Victoria | book, cancel, schedules, status lifecycle |
| `reception` | check-in, waiting room | Victoria | today's board, arrivals, no-shows |
| `questionnaires` | questionnaires and answers | Téo | monthly quality of life, end-of-pathway satisfaction, scores |
| `analytics` | de-identified indicators | — | patient-experience dashboard |
| `faq` | FAQ content | Louis | public read, admin editing |
| `notifications` | reminders, emails | — | files ready, not started |

## Team rules

Full details are in [AGENTS.md](AGENTS.md).

1. One folder per module. Use another module only through its `service.py`.
2. Rules and permission checks live in the backend service, never the frontend.
3. Permissions combine **role + care relationship**, with tests for the denied cases.
4. Reading or changing patient data is recorded with `audit.record`.
5. Tables change only through Alembic migrations; Louis reviews them.
6. **Synthetic data only.** No real patient data until HDS-certified hosting, a DPIA (data protection impact assessment) and access rules are approved.

## Open decisions

- **Frontend framework:** NiceGUI or React.
- **Rafaël / Hartmann:** do they share data or keep it separate?
- **Institute workflows to confirm:** who enters appointments, what reception does, what clinical data each role may see.
