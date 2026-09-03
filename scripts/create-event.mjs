// Inserts one `events` row from a JSON config file — the "spinning up a new event is a config
// task, not a code change" seam from generalize.md's Phase 2:
//
//   node --env-file=.env.local scripts/create-event.mjs scripts/example-event.json
//
// Kept dependency-free of the TypeScript app code (plain `node`, no ts-node/tsx) so it has no
// build step of its own — same reasoning as migrate.mjs.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const REQUIRED_STRING_FIELDS = [
  "id",
  "slug",
  "name",
  "eventDate",
  "paymentProvider",
  "organiserPin",
];
const REQUIRED_NUMBER_FIELDS = ["capacityCap", "perHeadFee", "retentionDays"];

// Pure — no I/O — so it's unit-testable on its own. Throws with a message naming every missing/
// wrong-typed field at once, rather than failing on the first one, since fixing a seed file one
// error at a time is exactly the friction Phase 2 was meant to remove.
export function validateEventInput(input) {
  const errors = [];
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof input[field] !== "string" || input[field].length === 0) {
      errors.push(`"${field}" must be a non-empty string`);
    }
  }
  for (const field of REQUIRED_NUMBER_FIELDS) {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field])) {
      errors.push(`"${field}" must be a number`);
    }
  }
  if (input.venue !== undefined && input.venue !== null && typeof input.venue !== "string") {
    errors.push('"venue" must be a string or null');
  }
  // Not in REQUIRED_STRING_FIELDS — main() auto-generates it when absent (issue #24), since an
  // operator shouldn't need to hand-author a random signing secret the way they choose a
  // memorable organiserPin. Only validated here if the input *did* supply one (e.g. a test
  // fixture pinning a known value).
  if (input.sessionSecret !== undefined && (typeof input.sessionSecret !== "string" || input.sessionSecret.length === 0)) {
    errors.push('"sessionSecret" must be a non-empty string when provided');
  }
  if (input.config !== undefined && typeof input.config !== "object") {
    errors.push('"config" must be an object');
  }
  if (input.paymentConfig !== undefined && typeof input.paymentConfig !== "object") {
    errors.push('"paymentConfig" must be an object');
  }
  if (errors.length > 0) {
    throw new Error(`Invalid event config:\n  - ${errors.join("\n  - ")}`);
  }
}

// Column order shared with scripts/sync-e2e-fixture.mjs's upsert, so the two scripts' INSERTs
// can never drift apart on which columns a JSON config file maps to. Pure — `input.sessionSecret`
// must already be resolved (main() below fills in a random default before calling this) — so this
// stays deterministic and unit-testable without touching node:crypto's randomness.
export function buildEventArgs(input) {
  return [
    input.id,
    input.slug,
    input.name,
    input.eventDate,
    input.venue ?? null,
    input.capacityCap,
    input.currency ?? "KES",
    input.perHeadFee,
    input.paymentProvider,
    JSON.stringify(input.paymentConfig ?? {}),
    input.retentionDays,
    input.organiserPin,
    input.sessionSecret,
    input.dataControllerName ?? null,
    input.dataControllerContact ?? null,
    JSON.stringify(input.config ?? {}),
  ];
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: node scripts/create-event.mjs <path-to-event-config.json>");
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(configPath, "utf-8"));
  // Auto-generated, not operator-authored — see the validateEventInput comment above (issue
  // #24). A fresh 32-byte random secret per event, distinct from organiserPin, used only for
  // signing that event's organiser session tokens.
  input.sessionSecret ??= randomBytes(32).toString("hex");
  validateEventInput(input);

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.execute({
    sql: `INSERT INTO events (
      id, slug, name, event_date, venue, capacity_cap, currency, per_head_fee,
      payment_provider, payment_config_json, retention_days, organiser_pin, session_secret,
      data_controller_name, data_controller_contact, config_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: buildEventArgs(input),
  });

  console.log(`Created event "${input.id}" (slug: ${input.slug}).`);
  client.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
