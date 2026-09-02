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
