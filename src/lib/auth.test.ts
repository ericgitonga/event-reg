import { timingSafeEqual } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrganiserSessionToken,
  safeEqual,
  verifyCronSecret,
  verifyOrganiserSessionToken,
  verifyPin,
} from "./auth";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(() => safeEqual("short", "a-lot-longer")).not.toThrow();
    expect(safeEqual("short", "a-lot-longer")).toBe(false);
  });

  it("returns false comparing against an empty string", () => {
    expect(safeEqual("abc", "")).toBe(false);
  });

  it("is backed by crypto.timingSafeEqual, not a fast-exit operator", () => {
    vi.mocked(timingSafeEqual).mockClear();
    safeEqual("abc123", "abc123");
    expect(timingSafeEqual).toHaveBeenCalled();
  });
});

describe("verifyPin", () => {
  it("accepts the correct pin for the given event", () => {
    expect(verifyPin("12345678", "12345678")).toBe(true);
  });

  it("rejects an incorrect pin", () => {
    expect(verifyPin("00000000", "12345678")).toBe(false);
  });

  it("rejects a non-string pin without throwing", () => {
    expect(() => verifyPin(undefined, "12345678")).not.toThrow();
    expect(verifyPin(undefined, "12345678")).toBe(false);
    expect(verifyPin(12345678, "12345678")).toBe(false);
    expect(verifyPin(null, "12345678")).toBe(false);
  });

  it("is scoped per-event: a PIN valid for one event is rejected against another's", () => {
    expect(verifyPin("12345678", "87654321")).toBe(false);
  });
});

describe("verifyCronSecret", () => {
  const ORIGINAL_ENV = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  it("accepts the correct bearer header", () => {
    expect(verifyCronSecret("Bearer test-cron-secret")).toBe(true);
  });

  it("rejects an incorrect bearer header", () => {
    expect(verifyCronSecret("Bearer wrong-secret")).toBe(false);
  });

  it("rejects a missing header without throwing", () => {
    expect(() => verifyCronSecret(null)).not.toThrow();
    expect(verifyCronSecret(null)).toBe(false);
  });

  it("rejects any header when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret("Bearer test-cron-secret")).toBe(false);
  });
});

describe("organiser session tokens", () => {
  const EVENT_A = "event-a";
  const EVENT_B = "event-b";
  const PIN_A = "12345678";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a freshly created token for the same event and PIN", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    expect(verifyOrganiserSessionToken(token, EVENT_A, PIN_A)).toBe(true);
  });

  it("rejects a token once its expiry has passed", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    vi.setSystemTime(new Date("2026-08-27T16:00:01Z")); // just past the 4-hour TTL
    expect(verifyOrganiserSessionToken(token, EVENT_A, PIN_A)).toBe(false);
  });

  it("accepts a token right up to the instant before expiry", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    vi.setSystemTime(new Date("2026-08-27T15:59:59Z")); // just before the 4-hour TTL
    expect(verifyOrganiserSessionToken(token, EVENT_A, PIN_A)).toBe(true);
  });

  it("rejects a token with a tampered expiry", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    const [eventId, , signature] = token.split(".");
    const tampered = `${eventId}.${Math.floor(Date.now() / 1000) + 999_999}.${signature}`;
    expect(verifyOrganiserSessionToken(tampered, EVENT_A, PIN_A)).toBe(false);
  });

  it("rejects a token with a tampered signature", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    const [eventId, expiresAt] = token.split(".");
    expect(
      verifyOrganiserSessionToken(`${eventId}.${expiresAt}.not-the-real-signature`, EVENT_A, PIN_A),
    ).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    expect(() => verifyOrganiserSessionToken("garbage", EVENT_A, PIN_A)).not.toThrow();
    expect(verifyOrganiserSessionToken("garbage", EVENT_A, PIN_A)).toBe(false);
    expect(verifyOrganiserSessionToken("", EVENT_A, PIN_A)).toBe(false);
    expect(verifyOrganiserSessionToken(undefined, EVENT_A, PIN_A)).toBe(false);
    expect(verifyOrganiserSessionToken(null, EVENT_A, PIN_A)).toBe(false);
  });

  it("rejects a token signed under a different PIN (e.g. after rotation)", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    expect(verifyOrganiserSessionToken(token, EVENT_A, "87654321")).toBe(false);
  });

  // The load-bearing new behaviour vs. busherian-hike's single-event version: a session issued
  // for one event must never validate against another, even if that other event happens to
  // share the same PIN — this is what stops a committee member's access to one event's
  // check-in from doubling as standing access to every other event this platform has run.
  it("rejects a token issued for a different event, even with the same PIN", () => {
    const token = createOrganiserSessionToken(EVENT_A, PIN_A);
    expect(verifyOrganiserSessionToken(token, EVENT_B, PIN_A)).toBe(false);
  });
});
