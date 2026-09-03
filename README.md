# UPSC Prep Tracker

A single-user study tracker for a UPSC Civil Services aspirant, organised by subject
across Prelims and Mains including the Anthropology optional. A responsive web
dashboard that works as well on a phone as it does at 1440px, built to be opened a
few times a day for two years.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffold — FastAPI, Mongo, API-key auth, app shell, unlock screen | done |
| 1 | Syllabus seed, tree, node CRUD | done |
| 2 | Activity logging and its side-effects | done |
| 3 | Revision queue and grading (SM-2) | done |
| 4 | Test attempts and the mistake notebook | done |
| 5 | Answer writing, the timer and the redo queue | done |
| 6 | Current affairs capture, tagging and the inbox | done |
| 7 | Progress aggregations, settings document, countdown | done |
| 8 | UI redesign — design system, responsive shell, dashboard, Settings screen | done |
| 9 | PWA polish, offline shell, icons | not started |

## Layout

```
backend/     FastAPI + Motor. Syllabus seed lives in data/syllabus/<subject>.json
frontend/    Vite + React + TypeScript + Tailwind, TanStack Query, React Router
             src/components/ui/  the design-system primitives every screen composes
```

## The interface

Desktop-first and fully responsive. A sticky top nav carries the five sections from
`lg` up; below that the same five live in a bottom tab bar, where a thumb can reach
them. Dialogs are centred modals from `sm` up and bottom sheets below it — one
component, `components/shell/Sheet.tsx`, decides that for all of them.

The palette is warm paper and deep navy with a single amber action colour, defined
once in `tailwind.config.ts`. Two rules constrain it: confidence is *depth of fill*
rather than a red-to-green ramp, and alerts are rationed — the crimson `danger` tone
is reserved for lateness past a fortnight. Charts cannot read Tailwind classes, so
`src/lib/tokens.ts` mirrors the palette as literal strings for them.

## Running it

### Backend

```bash
cd backend && python -m venv .venv && ./.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in:

- `MONGODB_URI` — the Atlas connection string
- `API_KEY` — any long random string; generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`

Then seed the syllabus and start the API:

```bash
cd backend && ./.venv/Scripts/python.exe scripts/seed_db.py
```

```bash
cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

`GET /health` is open; everything under `/api` needs the `X-API-Key` header.

### Frontend

```bash
cd frontend && npm install
```

Copy `.env.example` to `.env` (the default points at `http://localhost:8000/api`), then:

```bash
cd frontend && npm run dev
```

Open http://localhost:5173, enter the same `API_KEY` on the unlock screen. The key is
kept in `localStorage` and cleared automatically on a 401.

### Tests

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest -q
```

## Deployment

The frontend is a static bundle on **Cloudflare Pages**; the API runs on **Render**
against **MongoDB Atlas**. `render.yaml` describes the API service; Pages is
configured from its dashboard (root `frontend/`, build `npm run build`, output `dist`).

Two env vars tie the halves together and must agree:

- Render `ALLOWED_ORIGINS` — the Pages origin, no trailing slash. It is an exact
  list, so preview deployments on `*.pages.dev` are not covered by the production
  entry and need their own.
- Pages `VITE_API_BASE_URL` — the Render origin plus `/api`. Vite inlines it at
  build time, so changing it needs a redeploy, not just a restart.

Atlas must allow `0.0.0.0/0` under Network Access — Render's free tier has no
static outbound IP — so the database password carries the whole perimeter there.

Seeding is a one-off from a laptop with `MONGODB_URI` pointed at Atlas
(`python scripts/seed_db.py`); the free Render tier has no shell. The free API
instance also sleeps after 15 minutes idle and takes roughly a minute to wake.

## The syllabus seed

The syllabus is a flat list of subjects, each holding one level of topics — a lecture
or a book chapter. One file per subject under `backend/data/syllabus/`, 437 topics in
all. Subjects are labelled Prelims or Mains, which only groups the chips in the rail.

| Subject | Topics | Followed as |
| --- | --- | --- |
| Ancient & Medieval History | 42 | lectures |
| Modern History | 49 | Spectrum |
| Geography | 48 | lectures |
| Economics | 30 | Nitin Singhania |
| Polity & Governance | 65 | lectures |
| Science | 31 | lectures |
| CSAT | 10 | Arihant (placeholders) |
| Disaster Management | 4 | lectures |
| International Relations | 22 | lectures |
| Security | 10 | lectures |
| World History | 12 | lectures |
| Ethics | 24 | lectures |
| Anthropology | 90 | lectures |

Lecture topics seed as `Lecture 1 … Lecture N` and chapters as `Chapter N — Title`;
they are meant to be renamed in the app as the real titles become known. Only the
Spectrum chapters carry a real `pyq_weight`, taken from the priority bands in its
contents; everything else seeds at the neutral `medium`.

`scripts/build_syllabus_seed.py` regenerates the JSON from the lecture counts and the
contents files under `backend/data/sources/`. Run it only when the syllabus itself
changes — it overwrites every seed file.

Every node carries a `seed_key` — the slug chain of its titles *in the seed file*. The
seeder upserts on `(subject, seed_key)`, so renaming a node in the app never causes a
re-run to insert a duplicate. `scripts/seed_db.py` only ever inserts nodes it has not
seen; it never updates or deletes, and never touches custom nodes.

Because it never deletes, it cannot clear a syllabus seeded under a different subject
list. When the subjects themselves change, start over with
`python scripts/seed_db.py --reset` — which drops the syllabus and everything logged
against it, after asking.
