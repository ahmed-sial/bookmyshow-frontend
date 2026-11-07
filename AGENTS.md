# AGENTS.md — BookMyShow Web (React frontend)

Instructions for AI coding agents working in this repository. Read this file fully before making changes.

## 1. Project overview

BookMyShow Web is the React frontend for the BookMyShow cinema-booking backend (Go + PostgreSQL, REST API under `/api/v1`). It has two surfaces:

- **Customer app** (`/`): browse movies and showtimes, pick seats, hold them, pay (payment simulator), get QR tickets, view booking history.
- **Staff console** (`/admin`): box-office lookup and ticket check-in, manager tools (catalogue, scheduling, pricing, reports), admin tools (staff, audit log).

The backend is the single source of truth for inventory, pricing, and authorization. This app is a presentation and interaction layer only.

## 2. Source of truth

- `docs/frontend-specs.md` — the frontend spec (tentative). Follow it. Priorities are P0 > P1 > P2.
- `api/openapi.yaml` (or the backend repo's copy) — the API contract, once it exists.

If the code, the spec, and the API disagree, **stop and ask**. Do not silently pick one.
Items marked **[Open]** or **[Contract]** in the spec are undecided. Do not invent an answer; ask, or implement behind a small adapter and flag it.

## 3. Tech stack

TypeScript (strict), React (function components + hooks only), Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS, Vitest + React Testing Library, MSW, Playwright, ESLint (with jsx-a11y) + Prettier.

Do not add a dependency unless it clearly improves correctness or maintainability. Prefer the platform (`fetch`, `Intl`, `AbortController`) over libraries. Ask before adding any new runtime dependency.

## 4. Commands

Adjust if `package.json` differs; the scripts in `package.json` are authoritative.

```bash
npm install            # install dependencies
npm run dev            # Vite dev server (proxies /api to the Go backend)
npm run build          # type-check + production build
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Vitest (unit/component/integration with MSW)
npm run e2e            # Playwright (needs backend + PostgreSQL via Docker Compose)
```

Before declaring a task done, run: `typecheck`, `lint`, and the relevant tests. Fix failures you caused.

## 5. Project structure

```text
src/
├── app/          # app shell, providers, router, error boundary
├── api/          # fetch client, generated types, query keys, error mapping
├── features/     # auth, catalogue, seat-map, holds, checkout, bookings, tickets,
│                 # concessions, admin/{catalogue,scheduling,bookings,check-in,reports,staff,audit}
├── components/   # shared UI primitives
├── lib/          # money, time, idempotency, clock-offset, a11y helpers
├── routes/       # lazy-loaded route modules
└── test/         # test utilities, MSW handlers, fixtures
e2e/              # Playwright tests
```

- Each feature owns its components, hooks, and queries and exposes a public `index.ts`.
- Features may import from `api/`, `components/`, and `lib/`. **Do not import another feature's internals.**
- Keep route components thin; put logic in hooks and feature modules.
- Use absolute imports via the configured path alias (for example `@/features/...`).

## 6. Non-negotiable rules

These come from the backend's business rules. Violating them causes real bugs (double booking, false confirmations, wrong money).

1. **The server owns availability.** The seat map is advisory. A seat is the user's only after a successful hold response. Never mark seats as held/owned optimistically.
2. **Never trust the client clock for holds.** Use the server time returned with the hold to compute an offset, and derive the countdown from `expires_at`. When the countdown hits zero, re-verify with `GET /holds/{id}`.
3. **Money is integer minor units + ISO currency code.** Never use floats for money. Never add, multiply, or round prices in the UI — show the server's quote and totals. Convert decimal input to minor units only at the form boundary.
4. **Idempotency keys:** generate one UUID per user _intent_ (hold creation, checkout, refund), keep it across retries, and reuse it. Create a new key only for a genuinely new intent. Send it as the `Idempotency-Key` header.
5. **Never confirm from a redirect or a client-side result.** A booking is confirmed only when the server returns status `confirmed`. After checkout, poll `GET /bookings/{id}` until a terminal or review state.
6. **A timeout or network error on checkout is an unknown outcome**, not a failure. Show a "checking your payment" state and poll. Never tell the user the booking failed, and never release seats, because a request timed out.
7. **Handle `payment_review` explicitly.** It is neither success nor failure. Show the booking reference and clear guidance.
8. **Hold creation is all-or-nothing.** On `409 SEAT_UNAVAILABLE`, no seat was held: refetch the seat map, deselect the lost seats, keep the others selected, and explain.
9. **Show times in the branch's time zone** (`timezone` from the branch), not the browser's. Timestamps from the API are RFC 3339.
10. **Frontend authorization is cosmetic.** Hide UI by role for usability, but assume the backend enforces access. Never rely on client-side checks for security.
11. **Keep booking, payment, refund, and ticket statuses separate.** Do not collapse them into one status in the UI.

## 7. Coding conventions

- TypeScript strict. No `any` (use `unknown` and narrow). No non-null assertions (`!`) without a comment explaining why.
- Function components and hooks only. Memoize deliberately (the `Seat` component should be `React.memo`).
- Server data lives in TanStack Query. Do not copy server data into global client state. Keep global client state tiny (auth session, toasts).
- Filters, pagination, and tabs live in URL search params.
- Use the centralized query-key factory in `src/api/`. Invalidate relevant queries after each mutation (for example seat map after hold, release, or expiry).
- Forms: React Hook Form + Zod. Client validation is a UX aid; map server field errors back onto fields.
- Styling: Tailwind utilities. Reuse shared primitives from `src/components/` before creating new ones.
- Naming: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `camelCase.ts`, constants `SCREAMING_SNAKE_CASE`.
- Comments explain _why_, not _what_. No dead code, no commented-out blocks, no leftover `console.log`.

## 8. API client rules

- All HTTP goes through the single client in `src/api/`. Do not call `fetch` directly in components.
- The client normalizes the backend error envelope `{ error: { code, message, request_id } }` into a typed `ApiError`.
- On `401`: one shared silent refresh, then replay the request; if refresh fails, clear the session and redirect to login with a return URL.
- Do not auto-retry non-idempotent mutations unless they carry an idempotency key.
- Set request timeouts with `AbortController`.
- Show `request_id` in unexpected-error UI (small text) so failures can be traced.
- Types come from `openapi-typescript` once `openapi.yaml` exists; until then, keep hand-written API types in one place (`src/api/types.ts`) so they are easy to replace.

## 9. Security and privacy

- Never store tokens in `localStorage` or `sessionStorage`. Access tokens (if used) live in memory; refresh tokens or sessions use `HttpOnly` cookies set by the server. (Auth model is an **[Open]** decision; keep it behind the `auth` module.)
- Never put secrets in `VITE_` variables — they are public.
- Never log or send to analytics: emails, phone numbers, tokens, ticket tokens, payment payloads.
- Never use `dangerouslySetInnerHTML` with API content. Validate that poster and trailer URLs are `http(s)`.
- The payment simulator UI must be unreachable in production builds (guard with `import.meta.env`).
- No card data ever touches this app.

## 10. Accessibility

Target WCAG 2.2 AA.

- Everything must work by keyboard, especially the seat map (arrow keys to move, Space/Enter to toggle) and ticket check-in.
- Seat states must be distinguishable without color alone (icon, pattern, or label) and each seat needs an accessible name (for example "Row A, seat 1, available").
- Use live regions for seat conflicts, hold-expiry warnings, and payment status changes. Do not announce the countdown every second.
- Every form field has a label and an associated error message.

## 11. Testing

- Add or update tests with every behavior change. Prefer testing behavior over implementation details.
- Unit/component (Vitest + RTL): money/time helpers (including time zones and DST), hold countdown with a fake clock, idempotency-key lifecycle, error-code mapping, seat states and keyboard interaction, booking status screen for **every** status including `payment_review`, route guards.
- Integration (MSW): hold conflict, checkout failure then polling then confirmed, `401` refresh and replay, `429` handling.
- E2E (Playwright): browse, hold, pay, ticket; two browsers contending for the same seat; hold expiry during checkout; duplicate Pay click and reload mid-payment produce one booking; box-office check-in rejects a second scan.
- Do not delete or weaken a test to make it pass. If a test is wrong, explain why and fix it.

## 12. Git and workflow

- Work in small, reviewable changes: one feature or fix per branch and commit group.
- Commit messages: imperative mood, concise (for example `Add seat hold countdown hook`). Use Conventional Commits prefixes if the repo already does.
- Do not commit `.env` files, build output, or secrets. Commit only `.env.example`.
- Do not modify lockfiles unless dependencies actually changed.
- Follow the roadmap order in the spec (F0 to F6). Do not start a milestone's UI before its prerequisites exist, unless working against MSW mocks.

## 13. Boundaries

**Always do**

- Read the relevant section of `docs/frontend-specs.md` before implementing a feature.
- Handle loading, empty, and error states for every data-driven view.
- Run typecheck, lint, and relevant tests before finishing.
- Explain non-obvious decisions briefly in your summary.

**Ask first**

- Adding a new dependency or changing the build/tooling setup.
- Resolving any **[Open]** or **[Contract]** item from the spec.
- Changing routing structure, the auth approach, or the API client's core behavior.
- Anything that changes the meaning of a booking, hold, payment, or refund state in the UI.

**Never do**

- Compute or round prices on the client, or use floating-point money.
- Mark a booking confirmed from a redirect, a timeout, or local state.
- Treat a timed-out checkout as a failed one.
- Store tokens in web storage or log sensitive data.
- Bypass the API client, disable lint/type rules to silence errors, or use `any` to avoid typing a response.
- Invent backend endpoints or fields. If the API lacks what you need, flag it (see section 14 of the spec).

## 14. When you finish a task

Summarize in a few lines: what changed, which spec sections it implements, how you verified it (commands run, tests added), and any open questions or assumptions the developer should review.
