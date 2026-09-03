import { cache } from "react";
import { z } from "zod";
import { db } from "./db";

// Row shape exactly as stored — config_json/payment_config_json are still raw JSON strings here.
// See db/schema.sql for the column definitions this mirrors.
export type EventRow = {
  id: string;
  slug: string;
  name: string;
  event_date: string;
  venue: string | null;
  capacity_cap: number;
  currency: string;
  per_head_fee: number;
  payment_provider: string;
  payment_config_json: string;
  retention_days: number;
  organiser_pin: string;
  session_secret: string;
  data_controller_name: string | null;
  data_controller_contact: string | null;
  config_json: string;
  created_at: string;
};

// `config_json`/`payment_config_json` are deliberately loose here — issue #4 (registration form)
// and #5 (payment provider abstraction) own the concrete field-level schemas for what they
// actually consume. This only guarantees "valid JSON object", not any particular shape.
const JsonObjectSchema = z.record(z.string(), z.unknown());

export type Event = {
  id: string;
  slug: string;
  name: string;
  eventDate: string;
  venue: string | null;
  capacityCap: number;
  currency: string;
  perHeadFee: number;
  paymentProvider: string;
  paymentConfig: Record<string, unknown>;
  retentionDays: number;
  organiserPin: string;
  // Session-token signing key (issue #24) — never derived from organiserPin, never sent to a
  // client. Only ever read by src/lib/auth.ts's createOrganiserSessionToken/
  // verifyOrganiserSessionToken; nothing else should reference it.
  sessionSecret: string;
  dataControllerName: string | null;
  dataControllerContact: string | null;
  config: Record<string, unknown>;
  createdAt: string;
};

export function parseEventRow(row: EventRow): Event {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eventDate: row.event_date,
    venue: row.venue,
    capacityCap: row.capacity_cap,
    currency: row.currency,
    perHeadFee: row.per_head_fee,
    paymentProvider: row.payment_provider,
    paymentConfig: JsonObjectSchema.parse(JSON.parse(row.payment_config_json)),
    retentionDays: row.retention_days,
    organiserPin: row.organiser_pin,
    sessionSecret: row.session_secret,
    dataControllerName: row.data_controller_name,
    dataControllerContact: row.data_controller_contact,
    config: JsonObjectSchema.parse(JSON.parse(row.config_json)),
    createdAt: row.created_at,
  };
}

// Resolved from ACTIVE_EVENT_ID (checked first) or ACTIVE_EVENT_SLUG — pure, no I/O, so it's
// unit-testable without a database. Throws rather than returning null/undefined: every caller
// needs an active event to do anything useful, so a misconfigured deployment should fail loudly
// at the point of use, not thread an optional through every downstream function.
export function resolveActiveEventKey(env: {
  ACTIVE_EVENT_ID?: string;
  ACTIVE_EVENT_SLUG?: string;
  [key: string]: string | undefined;
}): { column: "id" | "slug"; value: string } {
  if (env.ACTIVE_EVENT_ID) return { column: "id", value: env.ACTIVE_EVENT_ID };
  if (env.ACTIVE_EVENT_SLUG) return { column: "slug", value: env.ACTIVE_EVENT_SLUG };
  throw new Error(
    "No active event configured — set ACTIVE_EVENT_ID or ACTIVE_EVENT_SLUG in the environment.",
  );
}

// Cached per-request (React's `cache()`, not a module-level cache — this must not survive
// across requests in a long-lived server process) so every Server Component/Action in a single
// request reads the same active event with one query, not one per constant access.
export const getActiveEvent = cache(async (): Promise<Event> => {
  const key = resolveActiveEventKey(process.env);
  const result = await db.execute({
    sql: `SELECT * FROM events WHERE ${key.column} = ? LIMIT 1`,
    args: [key.value],
  });
  const row = result.rows[0] as unknown as EventRow | undefined;
  if (!row) {
    throw new Error(`No event found with ${key.column} = "${key.value}".`);
  }
  return parseEventRow(row);
});
