-- `CREATE TABLE IF NOT EXISTS` only shapes a brand-new database — it can't retroactively alter
-- an already-provisioned one. Every future column addition needs its own `ALTER TABLE`, run
-- directly against the shared main/preview/prod database and the CI-only database, once each;
-- this file's `CREATE TABLE` definition only matters again if either database is ever recreated
-- from scratch.
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
-- src/lib/event-fields.ts. Payment-provider-specific columns (M-Pesa code/phone, etc.) are added
-- by a later ALTER TABLE once issue #5 lands, following the same incremental-migration
-- convention as busherian-hike's own schema.sql history.
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
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  checked_in INTEGER NOT NULL DEFAULT 0,
  checked_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations (event_id);
