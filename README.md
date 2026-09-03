# UPSC Prep Tracker

A single-user study tracker for a UPSC Civil Services aspirant covering GS 1–4, CSAT,
Essay and Anthropology optional. A responsive web dashboard that works as well on a
phone as it does at 1440px, built to be opened a few times a day for two years.

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
backend/     FastAPI + Motor. Syllabus seed lives in data/syllabus/<paper>.json
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

## The syllabus seed

Authored from the official UPSC CSE notification syllabus, one file per paper under
`backend/data/syllabus/`. Three levels: section → topic → leaf. Logs will attach to
levels 2 and 3.

Every node carries a `seed_key` — the slug chain of its titles *in the seed file*. The
seeder upserts on `(paper, seed_key)`, so renaming a node in the app never causes a
re-run to insert a duplicate. `scripts/seed_db.py` only ever inserts nodes it has not
seen; it never updates or deletes, and never touches custom nodes.
