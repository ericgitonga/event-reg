# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org) (pre-1.0: MINOR = new features/user-facing
behaviour, PATCH = fixes/docs/housekeeping — see `SKILL.md`).

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
