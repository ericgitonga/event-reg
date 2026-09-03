# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org) (pre-1.0: MINOR = new features/user-facing
behaviour, PATCH = fixes/docs/housekeeping — see `SKILL.md`).

## [0.7.0] - 2026-09-03

### Added

- Organiser payments dashboard at `/payments`: mark paid, resend confirmation SMS, delete a
  registration, search by name — ported from busherian-hike, generalized to display an event's
  custom fields generically instead of hardcoded school/ticket-type columns (closes #8)
- CSV export (`/api/export/registrations`), gated by a freshly re-verified PIN rather than the
  payments session cookie. `custom_fields_json` is dynamically flattened into one `custom_<key>`
  column per key actually present, rather than exported as an opaque JSON blob
- `markPaid`/`deleteRegistration`/`getAllRegistrations`/`getRegistrationsForPayments`/
  `getResendSmsTarget` are all event-scoped; `resendSmsConfirmation` takes the active event's
  name/date to rebuild the confirmation message

**Verified against the live Turso database and a running server**: seeded a real event +
registration with a payment proof, exercised the full HTTP flow — PIN unlock, mark paid, resend
SMS, CSV export (confirmed the dynamic `custom_ticketType` column), wrong PIN/no-session
rejected, delete, lock.

New e2e smoke check for `/payments`'s locked (PIN-entry) state, same reasoning as `/checkin`'s.

tag: `v0.7.0`

## [0.6.0] - 2026-09-03

### Added

- Organiser check-in flow at `/checkin`: PIN-gated, offline-capable (service worker + localStorage
  caching, pending-sync queue), QR scanning via `html5-qrcode` — ported from busherian-hike
- `events.organiser_pin` (per-event) replaces a shared `ORGANISER_PIN` env var; session tokens
  (`src/lib/auth.ts`) now carry which event they were issued for, so a session unlocked against
  one event's PIN can never be replayed against another event's data (closes #7)
- `getPaidAttendees`/`markCheckedIn` are event-scoped (`markCheckedIn` also scopes its UPDATE by
  `event_id` as defense in depth)
- `isLockedOut`/`recordAuthFailure`/`PIN_AUTH_RATE_LIMIT` added to `rate-limit.ts`

### Fixed

- `src/lib/db.ts`'s Turso client is now created lazily on first actual use, not at module load.
  Adding the first real API route (`/api/checkin/*`) exposed that the old eager
  `createClient()` call threw immediately without `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` — and
  Next.js's build-time page-data collection imports every route module (even ones that only
  transitively import `db.ts`) to inspect its config, so this failed `next build` outright in
  CI (no DB credentials there), not just at request time. Confirmed fixed by rebuilding locally
  with `.env.local` removed entirely.

**Verified against the live Turso database and a running server**: seeded a real event +
paid registration, exercised the full HTTP flow — wrong PIN rejected, correct PIN issues a
session, check-in marks the row, a repeat scan is a no-op, an unauthenticated request is
rejected, and locking the device invalidates the session.

`/checkin`'s locked (PIN-entry) state needs no live event, so it's covered by a new e2e smoke
check; the PIN-unlock and scan flow needs a real seeded event and isn't e2e-covered yet — see
issue #9's CI-database work.

tag: `v0.6.0`

## [0.5.0] - 2026-09-03

### Added

- `src/lib/confirmation.ts`/`confirmation-message.ts`: event-scoped confirmation message
  (event name/date come from the active event's row, not a hardcoded string) and orchestration,
  ported from busherian-hike
- `src/lib/sms.ts`: SasaSignal transactional SMS integration, ported as-is (deployment-level
  secret, not per-event)
- `src/lib/email.ts`: placeholder email confirmation (no real provider wired up yet), ported
  as-is
- `src/lib/qr.ts`: registration QR code generation, shared future infrastructure for both this
  issue's email attachment and issue #7's check-in scanning
- `completeRegistration` now fires the confirmation immediately after insert and records
  `sms_status`, matching busherian-hike's sequencing (closes #6)

`whatsapp.ts` was not ported — busherian-hike's own version is a permanently-shelved,
never-called placeholder; no reason to carry forward dead code into a fresh codebase.

tag: `v0.5.0`

## [0.4.0] - 2026-09-03

### Added

- `src/lib/payment.ts`/`payment-providers.ts`: event-scoped fee calculation and a
  `payment_provider` abstraction — `mpesa_manual` (direct M-Pesa send-and-prove-it, ported from
  busherian-hike) is the only provider implemented so far; a second provider is added when one
  is actually needed, not speculatively
- `src/lib/complete-registration.ts`: combines the registration schema with the active payment
  provider's proof schema into one — a registration row is only ever written together with its
  payment proof, matching busherian-hike issue #106's rework
- `RegistrationForm` component: renders the baseline fields plus an event's custom fields
  dynamically (from #4's field definitions), with a provider-branching payment step
- `src/app/actions.ts`: `validateRegistration`/`completeRegistration` server actions, event-scoped
  via `getActiveEvent()`, with the same two-step validate-then-write flow and rate limiting as
  busherian-hike
- `registrations` table gets `mpesa_code`/`payer_phone`/`sms_status` columns; `rate_limits` table
  added (event-agnostic)
- Closes #5

Confirmation/SMS sending is deliberately not wired into `completeRegistration` yet — see #6.
Neither `RegistrationForm` nor the server actions are wired into a page yet — that lands with #9
(landing page), alongside the CI database infrastructure a live page render will need.

tag: `v0.4.0`

## [0.3.0] - 2026-09-03

### Added

- `registrations` table, scoped by `event_id`, with baseline logistics/legal columns (name,
  guest count, next-of-kin, consent, terms) plus a `custom_fields_json` escape hatch for
  event-specific fields (closes #4)
- `src/lib/event-fields.ts`: `EventFieldDefinitionSchema` + `buildCustomFieldsSchema()` — an
  event's custom registration fields (age group, ticket type, school, ...) are now described by
  data in `config_json` and validated by a dynamically-built Zod schema, rather than hardcoded
  per-event TypeScript constants
- `src/lib/registration.ts`: `buildRegistrationSchema()` combines the fixed baseline with an
  event's custom fields into one schema
- `src/lib/capacity.ts`/`registrations-store.ts`: event-scoped `computeSlotsRemaining()` /
  `getPaidCount()` / `getSlotsRemaining()`, parameterized by event instead of a global constant

Registration form UI and the actual insert path are deferred to #5 (payment flow) — in the
ported architecture, a registration row is only ever written together with its payment proof, so
building the UI/write path ahead of the payment-provider abstraction it depends on would mean
redoing it once #5 lands.

tag: `v0.3.0`

## [0.2.0] - 2026-09-02

### Added

- `events` table (schema.sql) — one row per event this platform runs, with `config_json`/
  `payment_config_json` as the escape hatch for event-specific fields (closes #3)
- `src/lib/db.ts`: Turso client, ported from busherian-hike
- `src/lib/events-store.ts`: `getActiveEvent()` resolves the deployment's active event from
  `ACTIVE_EVENT_ID`/`ACTIVE_EVENT_SLUG`, cached per-request
- `scripts/migrate.mjs` and `scripts/create-event.mjs` — schema migration and event-seeding
  scripts, the "spinning up a new event is a config task, not a code change" seam

tag: `v0.2.0`

## [0.1.0] - 2026-09-02

### Added

- Initial project scaffold: repo, branch protection, CI (e2e gate on every PR), versioning and
  issue-first workflow (closes #1)

tag: `v0.1.0`
