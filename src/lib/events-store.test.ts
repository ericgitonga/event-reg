import { describe, expect, it, vi } from "vitest";

// events-store touches @/lib/db, which throws at import time without TURSO_* env vars
// (deliberately unset in the unit-test job) — mocked so the pure functions below (which never
// touch `db`) can still be tested without a real database. Same pattern as busherian-hike's
// confirmation.test.ts.
vi.mock("./db", () => ({ db: {} }));

import { type EventRow, parseEventRow, resolveActiveEventKey } from "./events-store";

const BASE_ROW: EventRow = {
  id: "ngong-hike-2026",
  slug: "ngong-hike-2026",
  name: "AHS/AGHS Alumni Ngong Hills Hike",
  event_date: "2026-09-19",
  venue: "Ngong Hills",
  capacity_cap: 100,
  currency: "KES",
  per_head_fee: 1500,
  payment_provider: "mpesa_manual",
  payment_config_json: JSON.stringify({ recipientPhone: "0723893192" }),
  retention_days: 30,
  organiser_pin: "1234",
  session_secret: "a".repeat(64),
  data_controller_name: "Jessica Rutto",
  data_controller_contact: "jessica@example.com",
  config_json: JSON.stringify({ tagline: "Watu!!" }),
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("parseEventRow", () => {
  it("maps snake_case columns to camelCase fields", () => {
    const event = parseEventRow(BASE_ROW);
    expect(event.eventDate).toBe("2026-09-19");
    expect(event.capacityCap).toBe(100);
    expect(event.perHeadFee).toBe(1500);
  });

  it("maps session_secret separately from organiser_pin — never derives one from the other", () => {
    const event = parseEventRow(BASE_ROW);
    expect(event.sessionSecret).toBe("a".repeat(64));
    expect(event.sessionSecret).not.toBe(event.organiserPin);
  });

  it("parses config_json and payment_config_json into objects", () => {
    const event = parseEventRow(BASE_ROW);
    expect(event.config).toEqual({ tagline: "Watu!!" });
    expect(event.paymentConfig).toEqual({ recipientPhone: "0723893192" });
  });

  it("passes through nullable columns as null", () => {
    const event = parseEventRow({ ...BASE_ROW, venue: null });
    expect(event.venue).toBeNull();
  });
});

describe("resolveActiveEventKey", () => {
  it("prefers ACTIVE_EVENT_ID over ACTIVE_EVENT_SLUG when both are set", () => {
    const key = resolveActiveEventKey({
      ACTIVE_EVENT_ID: "abc",
      ACTIVE_EVENT_SLUG: "def",
    });
    expect(key).toEqual({ column: "id", value: "abc" });
  });

  it("falls back to ACTIVE_EVENT_SLUG when ACTIVE_EVENT_ID is unset", () => {
    const key = resolveActiveEventKey({
      ACTIVE_EVENT_ID: undefined,
      ACTIVE_EVENT_SLUG: "def",
    });
    expect(key).toEqual({ column: "slug", value: "def" });
  });

  it("throws when neither is set", () => {
    expect(() =>
      resolveActiveEventKey({ ACTIVE_EVENT_ID: undefined, ACTIVE_EVENT_SLUG: undefined }),
    ).toThrow(/No active event configured/);
  });
});
