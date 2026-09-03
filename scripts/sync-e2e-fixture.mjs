// Upserts e2e/fixtures/event.json into the database as CI's dedicated e2e-fixture event — run
// on every CI job (.github/workflows/e2e.yml), not as a one-time manual step, so an edit to the
// fixture file (e.g. issue #10 adding config.legal) can never drift from what's actually seeded
// into event-reg-ci the way a manual one-off insert would. Safe to run against any database:
// upserts by id, so a stray local run against a database with other events' rows is unaffected.
//
//   node --env-file=.env.local scripts/sync-e2e-fixture.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { buildEventArgs, validateEventInput } from "./create-event.mjs";

async function main() {
  const fixturePath = fileURLToPath(new URL("../e2e/fixtures/event.json", import.meta.url));
  const input = JSON.parse(readFileSync(fixturePath, "utf-8"));
  validateEventInput(input);

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.execute({
    sql: `INSERT INTO events (
      id, slug, name, event_date, venue, capacity_cap, currency, per_head_fee,
      payment_provider, payment_config_json, retention_days, organiser_pin,
      data_controller_name, data_controller_contact, config_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      event_date = excluded.event_date,
      venue = excluded.venue,
      capacity_cap = excluded.capacity_cap,
      currency = excluded.currency,
      per_head_fee = excluded.per_head_fee,
      payment_provider = excluded.payment_provider,
      payment_config_json = excluded.payment_config_json,
      retention_days = excluded.retention_days,
      organiser_pin = excluded.organiser_pin,
      data_controller_name = excluded.data_controller_name,
      data_controller_contact = excluded.data_controller_contact,
      config_json = excluded.config_json`,
    args: buildEventArgs(input),
  });

  console.log(`Synced e2e fixture event "${input.id}" (slug: ${input.slug}).`);
  client.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
