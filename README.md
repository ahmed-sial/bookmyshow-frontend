# BookMyShow Web

React frontend for the BookMyShow cinema-booking platform. It consumes the Go
backend's REST API under `/api/v1` (see the sibling `bookmyshow-backend` repo).

> **Read `AGENTS.md` before making changes** — it contains the project rules
> (server-owned availability, idempotency, money handling, testing requirements).

**Status:** greenfield. Auth (register + login) is implemented; discovery,
seat maps, and checkout come later — see
`docs/BookMyShow Frontend — Technical Specification.md` for the full plan.

## Prerequisites

- Node.js (v20+)
- The Go backend (sibling `bookmyshow-backend` repo) running on `localhost:8080`
  when you want live API calls. Without it, use the UI and mocked tests only.

## Getting started

```bash
npm install
npm run dev        # dev server on :5173, proxies /api -> localhost:8080
```

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest (unit tests, no backend needed)
```

## Environment

Copy `.env.example` to `.env` if you need to override defaults. `VITE_`
variables are public — never put secrets in them.

## Auth (current scope)

- `POST /api/v1/identity/auth/register` — creates an account, returns `201`.
  The UI then auto-logs in by calling `/identity/auth/login` with the same
  credentials.
- `POST /api/v1/identity/auth/login` — returns the user and a bearer token.
  The access token is kept in memory only for the lifetime of the page.
  (The backend doesn't implement refresh/sessions yet, so a page reload
  requires logging in again.)
