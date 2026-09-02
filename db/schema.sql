-- `CREATE TABLE IF NOT EXISTS` only shapes a brand-new database — it can't retroactively alter
-- an already-provisioned one. Every future column addition needs its own `ALTER TABLE`, run
-- directly against the shared main/preview/prod database and the CI-only database, once each;
-- this file's `CREATE TABLE` definition only matters again if either database is ever recreated
-- from scratch. `registrations`' mpesa_code/payer_phone/sms_status were added this way (issue
-- #5, 2026-09-03) after the table already existed with issue #4's original column set.
--
-- One row per event this platform has ever run. `config_json` and `payment_config_json` are the
-- escape hatch for everything that doesn't deserve its own column yet — see
-- `src/lib/events-store.ts` for how they're parsed/consumed. See
-- extras/clients/busherians/generalize.md in the busherian-hike repo for the full design this
-- table implements.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  venue TEXT,
  capacity_cap INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  per_head_fee INTEGER NOT NULL,
  payment_provider TEXT NOT NULL,
  payment_config_json TEXT NOT NULL DEFAULT '{}',
  retention_days INTEGER NOT NULL,
  organiser_pin TEXT NOT NULL,
  data_controller_name TEXT,
  data_controller_contact TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per registration, scoped to the event it belongs to. Only the baseline
-- logistics/legal fields (see src/lib/registration.ts's BaseRegistrationSchema) get their own
-- column; everything event-specific (age group, ticket type, school, shirt size, ...) lives in
-- `custom_fields_json`, keyed by the field definitions in that event's own `config_json` — see
-- src/lib/event-fields.ts. mpesa_code/payer_phone are specific to the "mpesa_manual" payment
-- provider (src/lib/payment-providers.ts) — the only one implemented so far; a second provider
-- gets its own columns (or a generic payment_reference_json) added the same way, via ALTER
-- TABLE against an already-provisioned database, once it's actually needed. sms_status is
-- written by issue #6 (confirmation/SMS), not yet by anything in this file's history.
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events (id),
  name TEXT NOT NULL,
  guest_count INTEGER NOT NULL,
  next_of_kin_name TEXT NOT NULL,
  next_of_kin_contact TEXT NOT NULL,
  email TEXT,
  terms_accepted INTEGER NOT NULL DEFAULT 0,
  media_consent TEXT CHECK (media_consent IN ('yes', 'no')),
  custom_fields_json TEXT NOT NULL DEFAULT '{}',
  is_test_row INTEGER NOT NULL DEFAULT 0,
  mpesa_code TEXT,
  payer_phone TEXT,
  sms_status TEXT CHECK (sms_status IN ('sent', 'failed', 'skipped')),
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  checked_in INTEGER NOT NULL DEFAULT 0,
  checked_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations (event_id);

-- Fixed-window rate-limit counters (see src/lib/rate-limit.ts). bucket_key is
-- "<route>:<identifier>" (identifier is a client IP); window_start is the epoch-second start of
-- the current fixed window. Event-agnostic (keyed by route+IP, not any event's content) — no
-- event_id needed, per generalize.md §2.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);
