import { createClient, type Client, type InStatement } from "@libsql/client";

// Lazy, not created at module load — a top-level `createClient()` call throws immediately if
// TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are unset, and Next.js's build-time page-data collection
// imports every route module (including ones that only transitively import this file) to
// inspect its config, which triggered that throw and failed `next build` entirely in CI (no DB
// credentials there) even though no code path during that build ever calls `db.execute()`.
// Deferring client creation to first actual use means a module can safely import this file
// without a live database configured, and only paths that really touch the database need
// credentials to exist.
let client: Client | undefined;

function getClient(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set — run `vercel env pull .env.local`.",
    );
  }

  client = createClient({ url, authToken });
  return client;
}

export const db = {
  execute: (stmt: InStatement) => getClient().execute(stmt),
};
