import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const schemaPath = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
const schema = readFileSync(schemaPath, "utf-8");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.executeMultiple(schema);
console.log("Schema applied.");

// events.session_secret (issue #24) is new — `CREATE TABLE IF NOT EXISTS` above only shapes a
// brand-new database, so an already-provisioned one needs the column added and every existing
// row backfilled with its own random secret, same "ALTER TABLE, run once" pattern documented in
// db/schema.sql's own header comment. Done here (idempotently, safe to run every time) rather
// than as a one-off manual command, since this script already runs on every CI job and is the
// only migration path that reaches event-reg-ci without separate direct credentials.
const columns = await client.execute("PRAGMA table_info(events)");
const hasSessionSecret = columns.rows.some((row) => row.name === "session_secret");
if (!hasSessionSecret) {
  await client.execute("ALTER TABLE events ADD COLUMN session_secret TEXT NOT NULL DEFAULT ''");
  const existing = await client.execute("SELECT id FROM events WHERE session_secret = ''");
  for (const row of existing.rows) {
    await client.execute({
      sql: "UPDATE events SET session_secret = ? WHERE id = ?",
      args: [randomBytes(32).toString("hex"), row.id],
    });
  }
  console.log(`Added events.session_secret, backfilled ${existing.rows.length} row(s).`);
} else {
  console.log("events.session_secret already present — nothing to backfill.");
}

client.close();
