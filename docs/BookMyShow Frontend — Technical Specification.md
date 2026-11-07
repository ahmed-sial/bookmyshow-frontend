# BookMyShow Frontend — Technical Specification

**Document version:** 0.1 (tentative)\
**Status:** Draft — expect changes as the backend contract firms up\
**Companion to:** BookMyShow — Product Requirements & Technical Specification v1.0 (Go + PostgreSQL backend)\
**Implementation:** React single-page application (TypeScript)\
**Audience:** Product owner, frontend developer, tester, future maintainers

---

## 1. Overview

This document specifies the web frontend for BookMyShow. It consumes the REST API under `/api/v1` defined in the backend specification and covers two audiences: **customers** (discover, hold, pay, receive tickets) and **staff** (box office, managers, administrators, concession staff).

The backend is the single source of truth for inventory, pricing, and authorization. The frontend is a _presentation and interaction layer_: it must never decide whether a seat is available, whether a price is correct, or whether a user is allowed to do something. It displays what the server says and handles failure gracefully.

> **This spec is tentative.** Anything marked **\[Open\]** is an undecided design question. Anything marked **\[Contract\]** is a point where the backend spec is silent or ambiguous and the API shape needs confirming (collected in section 14).

### 1.1 Goals

1. Let a customer go from browsing to a confirmed booking with a QR ticket, with a clear and trustworthy seat-selection and checkout experience.
2. Make time-limited seat holds understandable: the user always knows how long they have left and what happens when it runs out.
3. Handle every failure the backend specifies — seat conflicts, expired holds, retries, delayed payments, `payment_review` — with explicit UI states rather than generic errors.
4. Give staff fast, keyboard-friendly tools for booking lookup, ticket check-in, and schedule/catalogue management.
5. Stay simple: one codebase, minimal dependencies, typed API access, reproducible tests.

### 1.2 Non-goals (first release)

- Native mobile apps (the web app must be responsive, but no React Native client is in scope).
- Real payment forms or card handling. The UI works with the payment simulator; no card data ever touches the frontend.
- Server-side rendering, SEO optimisation, or a marketing site.
- Offline mode or push notifications.
- Multi-language (i18n) and theming beyond light/dark — structure the code so i18n can be added, but do not build it now.
- Loyalty, social, or recommendation features (also non-goals in the backend spec).

---

## 2. Technology choices

These are recommended defaults; swap any of them if there is a concrete reason.

| Concern              | Choice                                                               | Notes                                                                   |
| -------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Language             | TypeScript (strict mode)                                             | Types generated from the API contract                                   |
| Build tool           | Vite                                                                 | Dev proxy to the Go server avoids CORS during development               |
| UI library           | React (current stable)                                               | Function components and hooks only                                      |
| Routing              | React Router (data router)                                           | Lazy-loaded route modules; separate `/admin` area                       |
| Server state         | TanStack Query                                                       | Caching, refetching, retries, mutation state                            |
| Client state         | React state + context; Zustand only if needed                        | Keep global client state tiny (auth session, toasts)                    |
| Forms/validation     | React Hook Form + Zod                                                | Client validation is UX only; server validates authoritatively          |
| Styling              | Tailwind CSS                                                         | Optionally with shadcn/ui or Radix primitives for accessible components |
| API types            | `openapi-typescript` from `api/openapi.yaml`                         | Fall back to hand-written types until the OpenAPI file exists           |
| Dates                | `Intl.DateTimeFormat` with explicit `timeZone`; `date-fns` if needed | Avoid heavy date libraries                                              |
| Money                | `Intl.NumberFormat` over integer minor units                         | No floating-point arithmetic on money                                   |
| QR codes             | A small client-side QR library                                       | Renders the server-issued ticket token                                  |
| Unit/component tests | Vitest + React Testing Library                                       |                                                                         |
| API mocking          | MSW (Mock Service Worker)                                            | Lets the frontend progress before backend milestones land               |
| End-to-end tests     | Playwright                                                           | Runs against the real backend + PostgreSQL via Docker Compose           |
| Linting/formatting   | ESLint (with jsx-a11y) + Prettier                                    | Enforced in CI                                                          |

---

## 3. Users and surfaces

| Surface                | Roles                       | Priority                                    |
| ---------------------- | --------------------------- | ------------------------------------------- |
| **Customer app**       | Anonymous visitor, Customer | P0                                          |
| **Box-office console** | Box-office staff            | P0 (lookup, check-in); P1 (walk-in booking) |
| **Manager console**    | Cinema manager              | P0 for catalogue/scheduling/reports         |
| **Admin console**      | Administrator               | P0 for staff and audit logs                 |
| **Concession screen**  | Concession staff            | P1                                          |

**Structure \[Open\]:** Start as one SPA with two lazy-loaded areas — the public/customer area at `/` and the staff console at `/admin`. Role-based navigation hides what a user cannot use, but this is purely cosmetic: **every authorization decision is made by the backend**. If the staff console grows large or needs different release timing, split it into a second app in the same repository (monorepo) later.

---

## 4. Core frontend principles

These follow directly from the backend's business rules and are mandatory.

1. **The server owns availability.** The seat map is advisory (backend DISC-04). A seat is the user's only after a successful hold. Never mark a seat "yours" optimistically before the hold call returns.
2. **Use server time for countdowns.** Hold responses include the expiry timestamp and the server's current time (BOOK-02). Compute `offset = serverNow − clientNow` once and derive the countdown from `expires_at`; do not trust the device clock.
3. **Money is integers.** All amounts are integer minor units plus an ISO currency code. Format only at the display boundary. Never sum, multiply, or round prices in the UI — display the server's quote and totals.
4. **Idempotency keys are generated once per user intent.** For hold creation and checkout, generate a UUID when the user starts the action, store it (for example in `sessionStorage` keyed by hold ID), and **reuse the same key on retry**. A new key is created only for a genuinely new intent.
5. **Never confirm from a redirect or client-side success.** A booking is confirmed only when the server says `confirmed`. After checkout the UI polls the booking until it reaches a terminal or review state.
6. **Never release seats because a request timed out.** A timeout or network error on checkout means the outcome is _unknown_: show a "checking your payment" state and poll, do not tell the user the booking failed.
7. **Timestamps are shown in the branch's time zone.** The API returns ISO 8601 / RFC 3339; display schedules using the branch's `timezone`, not the browser's.
8. **Fail visibly and specifically.** Map backend error codes to purposeful messages (section 10). Always surface the `request_id` somewhere unobtrusive so support can trace a failure.
9. **No sensitive data in logs or storage.** No tokens, emails, phone numbers, or payment payloads in `console.*`, analytics, or error-reporting breadcrumbs.

---

## 5. Application architecture

### 5.1 Suggested folder structure

```text
bookmyshow-web/
├── src/
│   ├── app/                  # app shell, providers, router, error boundary
│   ├── api/                  # http client, generated types, query keys, error mapping
│   ├── features/
│   │   ├── auth/
│   │   ├── catalogue/        # movies, branches, showtime search
│   │   ├── seat-map/         # seat map rendering + selection
│   │   ├── holds/            # hold lifecycle, countdown, extend/release
│   │   ├── checkout/         # quote, payment attempt, status polling
│   │   ├── bookings/         # history, details, cancel
│   │   ├── tickets/          # ticket view, QR
│   │   ├── concessions/      # P1
│   │   └── admin/
│   │       ├── catalogue/
│   │       ├── scheduling/
│   │       ├── bookings/
│   │       ├── check-in/
│   │       ├── reports/
│   │       ├── staff/
│   │       └── audit/
│   ├── components/           # shared UI primitives (Button, Dialog, Toast, Table…)
│   ├── lib/                  # money, time, idempotency, clock-offset, a11y helpers
│   ├── routes/               # route modules (lazy-loaded)
│   └── test/                 # test utilities, MSW handlers, fixtures
├── e2e/                      # Playwright tests
├── .env.example
└── README.md
```

Feature folders own their components, hooks, and queries. Features may import from `api/`, `components/`, and `lib/`, but not from each other's internals (use each feature's public `index.ts`). This mirrors the backend's modular-monolith boundaries.

### 5.2 API client

- A single `fetch` wrapper (no heavy HTTP library needed) handling base URL, JSON encoding, auth, request timeouts via `AbortController`, and error normalisation.
- Normalises the backend error envelope `{ error: { code, message, request_id } }` into a typed `ApiError`.
- Automatically attaches `Idempotency-Key` only where the caller supplies one.
- Handles one automatic token refresh on `401`, with a single in-flight refresh shared across concurrent requests; if refresh fails, clear the session and redirect to login preserving the return URL.
- Never retries non-idempotent mutations automatically unless they carry an idempotency key.
- Query keys are centralised and typed (`['showtimes', filters]`, `['hold', id]`, …).

### 5.3 Authentication in the frontend **\[Open\]**

The backend leaves the session model open (AUTH-01, ADR-003: server-side sessions _or_ short-lived access + refresh tokens). The frontend isolates this behind an `auth` module so either works:

- **If cookie sessions:** the browser handles credentials; the client sends `credentials: 'include'` and the app adds CSRF protection as the backend requires.
- **If access/refresh tokens:** keep the access token **in memory only**; keep the refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie set by the server. Do not store tokens in `localStorage`.

Either way, the module exposes: `login`, `register`, `logout`, `currentUser`, `roles`, and `hasPermission(...)` — the latter used only for showing or hiding UI.

Login errors are displayed generically (AUTH-06): never reveal whether the email or password was wrong.

### 5.4 Route guards

- `RequireAuth` redirects anonymous users to login and returns them afterward.
- `RequireRole` hides staff routes from users lacking a role. A direct URL visit by an unauthorized user shows a "not allowed" page; the backend's `403` is still the real enforcement.
- Guards never fetch or cache data a user should not see.

---

## 6. Customer application

### 6.1 Route map

| Route                               | Screen                                           | Auth                                          | Priority |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------- | -------- |
| `/`                                 | Home: now-showing movies, branch picker          | Public                                        | P0       |
| `/movies`                           | Movie listing with search/filter                 | Public                                        | P0       |
| `/movies/:movieId`                  | Movie details + showtimes                        | Public                                        | P0       |
| `/showtimes`                        | Showtime search (branch, date, language, format) | Public                                        | P0       |
| `/showtimes/:showtimeId/seats`      | Seat map and selection                           | Public to view; auth (or guest token) to hold | P0       |
| `/checkout/:holdId`                 | Review quote, start payment                      | Hold owner                                    | P0       |
| `/bookings/:bookingId`              | Booking status / confirmation                    | Owner                                         | P0       |
| `/tickets/:ticketId`                | Ticket with QR code                              | Owner                                         | P0       |
| `/account/bookings`                 | Booking history                                  | Customer                                      | P0       |
| `/login`, `/register`               | Authentication                                   | Public                                        | P0       |
| `/forgot-password`, `/verify-email` | Recovery flows                                   | Public                                        | P1       |
| `/concessions`                      | Order food and drinks                            | Customer                                      | P1       |

### 6.2 Discovery (DISC-01, DISC-02, DISC-05)

- Movie cards show poster, title, age rating, runtime, language, genres. Only published movies are returned by the API; the UI does not filter.
- Movie detail page shows synopsis, credits, trailer link, languages/subtitles, and showtimes grouped by branch and date.
- Showtime search filters: branch, date, language, format. Filters live in the URL query string so views are shareable and the back button works.
- Each showtime row shows start time (branch time zone), format, language, and an **availability summary** (for example "Filling fast") — advisory only.
- Pagination: follow whichever scheme the backend chooses (cursor or limit/offset); wrap it in one `usePaginated` hook.
- States for every list: loading skeleton, empty ("No showtimes for this date"), error with retry.

### 6.3 Seat map (DISC-03, CIN-03)

**Rendering**

- Built from the seat definitions returned by `GET /showtimes/{id}/seats`, positioned using each seat's `x_position`/`y_position`; seat labels are stable (`A-01`).
- Render as SVG or CSS grid; use one `Seat` component with `React.memo` so large screens stay fast.
- Zoom/pan is **P1**; the first version must simply fit and scroll on small screens.

**States** — each must be distinguishable _without relying on colour alone_ (use icon/pattern/label as well):

| State                 | Meaning                                                       | Selectable   |
| --------------------- | ------------------------------------------------------------- | ------------ |
| Available             | Free to hold                                                  | Yes          |
| Selected              | Chosen locally, not yet held                                  | Yes (toggle) |
| Held                  | Held by someone else (identity never shown)                   | No           |
| Sold                  | Booked                                                        | No           |
| Blocked / maintenance | Not sellable                                                  | No           |
| Accessible            | Accessibility designation; combinable with available/selected | Yes          |

A legend is always visible.

**Interaction**

- Click/tap or keyboard (arrow keys to move, Space/Enter to toggle) selects seats. Selection is local UI state until the user presses **Continue**.
- Enforce a client-side maximum seats per booking if the backend defines one **\[Contract\]**.
- Show a running summary (seats, indicative price). The authoritative quote comes from the hold response.
- Refresh availability on an interval (for example every 15–30 s while the tab is visible) and on window focus. Server-sent updates are a possible later enhancement **\[Open\]**.
- If a refresh shows a locally selected seat is no longer available, deselect it and tell the user which seat was lost.

### 6.4 Seat hold (BOOK-01 – BOOK-04)

**Create hold:** `POST /showtimes/{id}/holds` with the selected seat IDs and an `Idempotency-Key`.

- **Success (all-or-nothing):** navigate to checkout with the hold ID. The response supplies hold ID, expiry, seats, quote, and server time.
- **`409 SEAT_UNAVAILABLE`:** none of the seats were held. Refetch the seat map, deselect the unavailable seats, keep the rest selected, and explain what happened. Never claim a partial hold.
- **Network failure/timeout:** retry with the **same** idempotency key. The server returns the same result if the first attempt succeeded.

**Hold countdown (global component)**

- Visible on seat-confirmation and checkout screens; shows minutes:seconds remaining, derived from `expires_at` and the clock offset.
- Turns visually urgent below a threshold (for example 60 s) and announces changes to screen readers at sensible intervals (not every second).
- At zero: mark the hold expired locally, stop offering checkout, and re-verify with `GET /holds/{id}` — the server is authoritative. Offer "Choose seats again".
- **Extend:** a single "Need more time?" action calls `POST /holds/{id}/extend`. Shown only while the hold is active and no payment attempt has started; hide it after one successful extension or when the server rejects it. Do not assume the extension length — read the new expiry from the response.
- **Release:** leaving checkout deliberately ("Change seats" or "Cancel") calls `DELETE /holds/{id}`. Best-effort release on tab close is acceptable (`sendBeacon` or `keepalive`), but expiry on the server is the real safety net.
- If the user reloads the page, rehydrate the hold from `GET /holds/{id}` (hold ID in the URL).

### 6.5 Checkout and payment (BOOK-05 – BOOK-07, PAY-\*)

**Checkout screen**

- Shows the quote exactly as returned by the server: ticket subtotal, discount, fees, taxes (if configured), concession subtotal, total. No client-side arithmetic.
- Coupon entry is **P1** (PRICE-03); if added, the quote is re-requested from the server.
- Guest checkout details **\[Open\]** — see section 12.
- The **Pay** button is disabled once pressed; the in-flight request carries an `Idempotency-Key` generated for this checkout attempt and kept for retries.

**After pressing Pay** (`POST /holds/{id}/checkout`)

The UI moves to a **booking status screen** (`/bookings/:id`) that polls `GET /bookings/{id}` (every \~2 s, backing off to \~5–10 s, with an overall timeout after which it shows a "still processing" message with a refresh option). Polling stops on a terminal state.

| Booking status    | What the UI shows                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending_payment` | "Confirming your payment…" with spinner; do not offer to retry payment blindly.                                                                                                     |
| `confirmed`       | Success, booking reference, ticket(s) with QR, "Add to calendar" (P2).                                                                                                              |
| `cancelled`       | Explain that payment failed or timed out and seats were released (if the backend says so); offer to start again.                                                                    |
| `payment_review`  | "We received your payment but need to verify your booking. We'll email you or refund you." Show the booking reference and support guidance. Never present it as success or failure. |
| `completed`       | Past booking; ticket shown as used/expired.                                                                                                                                         |

- A **payment simulator** screen or panel exists for development only, to trigger success, failure, delay, timeout, and duplicate-callback scenarios **\[Contract\]**. It must not be reachable in production builds (guard with `import.meta.env`).
- A browser redirect back from a provider is treated purely as a _navigation event_; status always comes from the server.

### 6.6 Bookings and tickets (BOOK-08, BOOK-09)

- **My bookings** (`GET /me/bookings`): list with status, movie, showtime, seats, total; tabs for upcoming/past.
- **Booking detail:** itemised seats and prices from the price snapshot, status history if exposed, ticket links, cancel action.
- **Cancel:** shown only when allowed; the UI does not compute eligibility itself — it calls `POST /bookings/{id}/cancel` and shows the server's decision. If the response or booking data exposes eligibility/cutoff **\[Contract\]**, display it in advance; otherwise explain the policy text on rejection. Refund status is shown separately from booking status.
- **Ticket view:** large, high-contrast QR code rendered from the server-provided token, plus seat, showtime, branch, and booking reference. Brightness-friendly layout for scanning on phones. Tokens are never logged or put in URLs beyond the ticket ID.
- Ticket states: `valid`, `checked_in`, `void` shown distinctly; a checked-in or void ticket no longer presents a scannable-looking QR.

### 6.7 Concessions (P1)

- Product list by branch/category, availability, cart, order creation (`POST /concessions/orders`), and order status. Either attached to a booking or standalone, depending on the backend decision **\[Contract\]**.
- Out of scope for the first frontend milestones.

---

## 7. Staff console (`/admin`)

The console is a desktop-first, dense, keyboard-friendly interface. Role-based nav shows only relevant sections.

### 7.1 Box-office staff

| Screen                         | Requirement                                                                                                                   | API                                 | Priority |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| **Booking lookup**             | Search by booking reference, customer contact, or ticket code; results table; detail drawer                                   | `GET /admin/bookings`               | P0       |
| **Ticket check-in**            | Large input/scan field; instant clear result: _Admitted_, _Already checked in (time/by)_, _Invalid_, _Wrong showtime_, _Void_ | `POST /admin/tickets/{id}/check-in` | P0       |
| **Refund request**             | Reason required, amount ≤ refundable amount (server-validated), idempotent submit                                             | `POST /admin/bookings/{id}/refunds` | P0       |
| **Walk-in booking**            | Reuses the customer seat map and hold flow with a staff payment-confirmation step                                             | `POST /admin/bookings/walk-in`      | P1       |
| **Resend ticket/confirmation** | Button on booking detail                                                                                                      | (BOOK-12) **\[Contract\]**          | P1       |

Check-in specifics: the result display must be unambiguous at a glance (large colour **and** text/icon), auto-return focus to the input after each scan, and keep a short on-screen history of recent scans. Camera-based QR scanning is **P2**; the first version works with a hardware scanner that types into a focused field.

### 7.2 Cinema manager

| Area                   | Requirement                                                                                                                                                                                                                                        | Priority |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Branches & screens** | CRUD forms with time zone, status, screen type, accessibility metadata                                                                                                                                                                             | P0       |
| **Seat layout editor** | Grid-based editor for row/seat labels, class, accessibility, coordinates, active/blocked/maintenance; respect versioned layouts (CIN-05) — surface the server's rejection when a change would affect published showtimes                           | P0       |
| **Movies**             | CRUD, publish/archive, genres, credits, poster/trailer URLs, search                                                                                                                                                                                | P0       |
| **Showtimes**          | Create/edit with movie, screen, start time, language, format, pricing plan; show computed end time; display overlap errors clearly; publish/unpublish/reschedule/cancel with a required reason where applicable; calendar/timeline view per screen | P0       |
| **Pricing plans**      | Manage plans and price rules; amounts entered as decimal currency in the UI and converted to integer minor units **at the form boundary only**                                                                                                     | P0       |
| **Promotions**         | Coupon management                                                                                                                                                                                                                                  | P1       |
| **Reports**            | Sales and occupancy with date/branch/movie/showtime filters; clearly labelled metrics (gross, refunded, net, sold vs held vs confirmed); tables first, charts later                                                                                | P0       |
| **CSV export**         | Export buttons for reports and bookings                                                                                                                                                                                                            | P1       |

Showtime cancellation is a **destructive, high-impact** action: use a confirmation dialog that states the number of affected bookings (if the API provides it) and requires a reason.

### 7.3 Administrator

| Area                       | Requirement                                                                                                                      | Priority |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Staff accounts & roles** | List, create, edit, assign roles; a staff member cannot grant themselves roles (server enforces; UI disables self-edit of roles) | P0       |
| **Audit log viewer**       | Search/filter by actor, action, resource, date; read-only; shows `request_id`                                                    | P0       |
| **Operational views**      | Pending payments, `payment_review` bookings, failed jobs, compensation actions                                                   | P1       |

### 7.4 Concession staff (P1)

A simple order board (placed → accepted → preparing → ready → fulfilled / cancelled) showing only operationally necessary fields; no customer PII beyond what the backend returns.

### 7.5 Common admin patterns

- Reusable data-table component: server-side pagination, sorting, filtering, column visibility, empty/error/loading states.
- Forms: field-level validation from Zod plus server-side field errors mapped back onto fields.
- Every mutating action shows pending, success, and failure states; destructive actions require confirmation; actions requiring a reason (overrides, cancellations, refunds) use a mandatory reason field (backend 3.4, 3.5).
- Concurrent edits: if the server rejects an edit due to a conflict (for example overlapping showtime written concurrently), show the specific message and keep the user's input intact.

---

## 8. State management

| Kind of state                                             | Where it lives                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| Server data (movies, showtimes, seats, bookings, reports) | TanStack Query cache                                             |
| Current seat selection (pre-hold)                         | Local component/feature state                                    |
| Active hold (ID, expiry, clock offset)                    | Query cache for `['hold', id]` + a small `useHoldCountdown` hook |
| Checkout idempotency key                                  | `sessionStorage`, keyed by hold ID                               |
| Auth session                                              | `auth` module (in-memory + cookie)                               |
| Filters, pagination, selected tab                         | URL search params                                                |
| UI chrome (dialogs, toasts)                               | Local state / a tiny context                                     |

Rules of thumb: don't duplicate server data into global client state; derive instead. Invalidate relevant queries after each mutation (for example invalidate the seat map after hold/release/expiry).

**Caching guidelines**

- Movies/branches: moderate stale time (minutes).
- Showtime lists: short stale time (tens of seconds).
- Seat maps: very short stale time plus interval refetch while visible.
- Holds, bookings, payments: always fresh (`staleTime: 0`); poll where specified.
- Never cache or persist ticket tokens beyond the session; clear the query cache on logout.

---

## 9. Responsiveness and accessibility

- **Responsive:** the customer area is mobile-first (most bookings happen on phones); the staff console is desktop-first but usable on a tablet (check-in may happen on one).
- **Accessibility target:** WCAG 2.2 AA.
  - Full keyboard operation, including the seat map.
  - Visible focus indicators, logical focus order, and focus management after route changes and dialogs.
  - Seat states conveyed by more than colour; each seat has an accessible name (for example "Row A, seat 1, available, accessible seat").
  - Live-region announcements for seat conflicts, hold-expiry warnings, and payment status changes.
  - Sufficient contrast, reduced-motion support, and no surprise time limits — the hold timer is explained and extendable once.
  - Form labels, error association, and `autocomplete` attributes.
- Run automated checks (`axe-core`, ESLint `jsx-a11y`) and a manual keyboard pass for the seat-selection and check-in flows.

---

## 10. Error handling and messaging

Backend errors arrive as `{ "error": { "code", "message", "request_id" } }`. The frontend keeps a code-to-UX map so messages are consistent and friendly. The backend's message is a fallback, not the primary copy.

| Situation                                       | Expected code/status                                | UI behaviour                                                                                 |
| ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Seats taken during hold                         | `409 SEAT_UNAVAILABLE`                              | Refresh map, keep still-available selection, explain which seats were lost                   |
| Hold expired / not found                        | Hold-expired style code, `404/410` **\[Contract\]** | Explain, release local state, link back to the seat map                                      |
| Idempotency key reused with a different payload | `409` conflict                                      | Treat as a bug; create a fresh intent only if the user restarts; log the request ID          |
| Validation failure                              | `400/422`                                           | Map field errors onto form fields                                                            |
| Not authenticated                               | `401`                                               | Silent refresh once, then redirect to login with return URL                                  |
| Not permitted                                   | `403`                                               | "You don't have access to this" page/toast                                                   |
| Rate limited                                    | `429`                                               | Friendly "slow down" message; respect `Retry-After` if present                               |
| Server/network failure                          | `5xx` / offline                                     | Retry affordance; for checkout, enter the _unknown outcome_ polling state instead of failing |

Every unexpected error surface includes "Reference: `<request_id>`" in small text. A top-level React error boundary catches rendering failures and offers reload / return home.

---

## 11. Security and privacy

- Treat all frontend authorization as cosmetic; rely on the backend for enforcement and IDOR protection.
- No tokens in `localStorage`/`sessionStorage` (the only `sessionStorage` use is non-sensitive idempotency keys and UI state).
- Prevent XSS: never use `dangerouslySetInnerHTML` with API content; sanitise any rich text if it is ever rendered as HTML; validate that poster/trailer URLs are `http(s)`.
- Deploy with a restrictive Content Security Policy and standard security headers (set by the web server/CDN).
- If cookie auth is used: CSRF protection as specified by the backend, `credentials: 'include'`, and `SameSite` settings coordinated with the API origin.
- Do not log or send to analytics: emails, phones, tokens, ticket tokens, payment payloads. Strip sensitive query strings before logging URLs.
- Guest booking access tokens (if implemented) are never placed in URLs that could leak via referrers.
- Dependency hygiene: committed lockfile, automated audit in CI, minimal dependencies.
- Staff routes are not indexed (`noindex`); agree a session-timeout approach with the backend.
- Variables prefixed `VITE_` are public. **Never put secrets in them** (the payment webhook secret stays on the backend).

---

## 12. Open decisions

Resolve these before or during the relevant milestone. Each should become a short note in `docs/decisions/` in the frontend repo.

1. **Auth session model** — cookie sessions vs access/refresh tokens (mirrors backend ADR-003).
2. **Guest checkout** — supported at launch? If yes: how is the guest token delivered (email link?) and how does a guest recover a booking (backend decision 3)?
3. **One app or two** — single SPA with `/admin`, or separate customer and staff apps.
4. **Seat-map refresh strategy** — polling only, or add SSE/WebSocket later for live availability.
5. **Component library** — hand-built Tailwind components vs shadcn/ui or Radix.
6. **Hosting** — static hosting/CDN with a reverse proxy to the Go API, or served by the Go binary itself.
7. **Currency and locale** — launch currency and display locale (backend decision 4); keep formatting locale-configurable.
8. **Max seats per booking** and checkout polling timeout values.
9. **Analytics/error tracking** — whether to include any, and the privacy constraints.
10. **Seat-map renderer** — SVG vs CSS grid vs canvas (decide after testing on the largest realistic screen layout).

---

## 13. Roadmap

Frontend milestones track the backend milestones; each ends with exit criteria and passing tests. With MSW mocks the frontend can run slightly ahead of the backend.

### F0 — Foundation

- Vite + TypeScript + React app, linting, formatting, CI, folder structure.
- API client, error normalisation, query client, router skeleton, layout, auth shell.
- Dev proxy to the Go server; MSW set up; `.env.example`.

**Exit:** App builds, lints, and runs tests in CI, and shows a page that calls `/health/ready` (or a mocked equivalent).

### F1 — Discovery (needs backend M1 data)

- Home, movie list/detail, branches, showtime search with URL-synced filters.
- Loading/empty/error states, responsive layout.

**Exit:** A visitor can browse published movies and find showtimes by branch, date, language, and format.

### F2 — Seat map and holds (needs backend M2)

- Seat-map renderer with all states, keyboard navigation, legend.
- Atomic hold creation, conflict handling, countdown with server-time offset, extend, release, rehydration on reload.

**Exit:** A user can hold seats, see an accurate countdown, handle `SEAT_UNAVAILABLE`, and recover from reload/expiry. A two-browser contention scenario is verified in an E2E test.

### F3 — Checkout and tickets (needs backend M3)

- Quote display, idempotent checkout, booking status polling with all states, `payment_review` handling.
- Ticket page with QR; dev-only payment simulator controls.

**Exit:** Success, failure, delayed, timeout-then-success, duplicate-click, and reload-during-payment scenarios behave correctly and never double-submit.

### F4 — Accounts and staff basics (needs backend M4)

- Register/login/logout, booking history, cancellation.
- Staff booking lookup, ticket check-in, refunds; route guards.

**Exit:** Customer and box-office flows work end to end; unauthorized staff routes are refused by the backend and handled gracefully in the UI.

### F5 — Manager and admin consoles (needs backend M1, M5)

- Branches, screens, seat-layout editor, movies, showtimes, pricing plans.
- Reports, staff management, audit log viewer.

**Exit:** A manager can configure a realistic schedule from scratch through the UI, and overlapping or invalid schedules produce clear errors.

### F6 — Polish and P1 features

- Concessions, promotions/coupons, walk-in booking, CSV export, password reset and email verification.
- Accessibility audit, performance pass, Lighthouse checks, error tracking (if chosen), documentation.

**Exit:** Full workflows documented and tested; accessibility and performance baselines recorded.

Do not move to the next milestone just because screens exist; move when the exit criteria and tests pass.

---

## 14. Backend contract questions

Points where the backend spec does not yet define what the frontend needs. Resolve these in `api/openapi.yaml`.

1. **Checkout response shape** — does `POST /holds/{id}/checkout` return a booking ID plus payment attempt immediately, and what fields drive the simulator flow?
2. **Hold response** — confirm it includes `expires_at` and `server_time`, and whether extension eligibility (can-extend, remaining extensions) is exposed.
3. **Seat map payload** — field names for seat state, class, accessibility, coordinates, and per-seat price; whether the layout version is included.
4. **Max seats** per hold and per booking.
5. **Cancellation eligibility** — can the booking response expose `can_cancel` and the cutoff time so the UI can explain it up front?
6. **Refund amount preview** — is the refundable amount returned before the user confirms?
7. **Pagination scheme** and standard list envelope.
8. **Hold-expiry error codes** and status codes for expired/not-found/released holds.
9. **Payment simulator control** — how scenarios are triggered for dev/demo and E2E tests.
10. **Ticket token format** for the QR payload, and whether check-in accepts the token or the ticket ID.
11. **Guest access** — token delivery and the endpoints used for guest booking retrieval.
12. **Resend ticket/confirmation** endpoint (BOOK-12).
13. **CORS and cookie settings** for the chosen auth model and hosting arrangement.
14. **Affected-bookings count** when cancelling a showtime, for the confirmation dialog.

---

## 15. Testing strategy

### Unit and component tests (Vitest + React Testing Library)

- Money and time formatting helpers, including branch-time-zone and DST edge cases.
- Hold countdown hook with a fake clock and server-offset logic.
- Idempotency-key lifecycle (reused on retry, regenerated for a new intent).
- Error-code to message mapping.
- Seat component states and keyboard interaction.
- Booking status screen for every status, including `payment_review`.
- Auth guards and role-based navigation.

### Integration tests (MSW)

- Hold conflict, then map refresh, then partial selection preserved.
- Checkout network failure leads to polling (not failure) and an eventual confirmed state.
- `401` leads to a single refresh and request replay; refresh failure redirects to login.
- Rate-limit (`429`) handling.

### End-to-end tests (Playwright, real backend + PostgreSQL)

- Browse, select seats, hold, pay (simulator), ticket shown.
- **Two browsers, same seat:** exactly one wins; the other sees `SEAT_UNAVAILABLE` handled gracefully.
- Hold expiry while on checkout.
- Duplicate Pay click and a page reload mid-payment produce a single booking.
- Delayed and late-success payment scenarios from the simulator.
- Box office: look up a booking, check in a ticket, reject a second check-in.
- Manager: create a showtime, attempt an overlapping one, see the rejection.
- Role checks: a customer cannot reach `/admin`; box office cannot reach manager-only pages.

### Quality checks

- `tsc --noEmit`, ESLint, Prettier, unit/integration tests, and accessibility checks run in CI.
- Bundle-size budget for the customer area; the staff console is lazy-loaded so it does not weigh on customers.
- Lighthouse (performance, accessibility, best practices) baselines recorded each milestone.

---

## 16. Performance targets (initial)

Tentative, to be validated and revised after measurement:

- Customer area initial JavaScript kept modest via route-level code splitting; the staff console is excluded from it.
- Largest Contentful Paint under about 2.5 s on a mid-range phone over a typical connection for the home and movie pages.
- Seat map stays responsive for the largest realistic screen layout.
- No refetch storms: seat-map polling pauses when the tab is hidden.

---

## 17. Configuration

Public build-time variables (never secrets), committed only as `.env.example`:

- `VITE_API_BASE_URL` — API base path (default `/api/v1`, proxied in development).
- `VITE_APP_ENV` — `development` | `staging` | `production`.
- `VITE_ENABLE_PAYMENT_SIMULATOR_UI` — development/staging only; must be `false` in production.
- `VITE_SEATMAP_POLL_INTERVAL_MS`, `VITE_BOOKING_POLL_INTERVAL_MS`, `VITE_BOOKING_POLL_TIMEOUT_MS`.
- `VITE_MAX_SEATS_PER_BOOKING` — only if not supplied by the API.
- `VITE_DEFAULT_LOCALE` / `VITE_DEFAULT_CURRENCY` — display defaults; the API remains the source of truth for each booking's currency.

Validate configuration at startup and fail loudly in development when a required variable is missing.

---

## 18. Definition of done

A frontend feature is complete when:

- Its happy path **and** the relevant backend failure cases are implemented with explicit UI states.
- Loading, empty, error, and offline-ish states are handled.
- Retryable mutations use idempotency keys as specified.
- Authorization failures (`401`/`403`) are handled gracefully.
- It is keyboard-operable and passes automated accessibility checks.
- Unit/component tests and relevant E2E tests pass in CI.
- No secrets, tokens, or personal data leak into logs, storage, or URLs.
- It is documented, including how to run it locally against the backend.

---

## 19. Required documentation

- `README.md` — prerequisites, install, dev proxy setup, scripts, environment variables, test commands.
- `docs/architecture.md` — feature boundaries, data flow, state strategy, API-client behaviour.
- `docs/decisions/` — short notes for the open decisions in section 12.
- `docs/seat-map.md` — rendering approach, states, accessibility behaviour.
- `docs/checkout-flow.md` — hold, idempotency, polling, and `payment_review` handling.
- `e2e/README.md` — how to run the end-to-end suite and simulator scenarios.

---

## 20. Guiding principle

The backend's value is correctness under stress; the frontend's value is **honesty under uncertainty**. When the outcome of an action is unknown, say so, keep the user informed, and let the server decide. A UI that never shows a false "success" or a false "failure", and never lets a double-click or a reload create a second booking, is worth more than one with the most polished animations.
