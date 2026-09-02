# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org) (pre-1.0: MINOR = new features/user-facing
behaviour, PATCH = fixes/docs/housekeeping — see `SKILL.md`).

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
