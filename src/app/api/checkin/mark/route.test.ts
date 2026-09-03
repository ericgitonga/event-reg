import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependencies never actually load — same pattern as the cron route
// tests. `@/lib/auth` is deliberately NOT mocked: the real createOrganiserSessionToken/
// verifyOrganiserSessionToken are exactly what's under test here (issue #24).
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/events-store", () => ({ getActiveEvent: vi.fn() }));
vi.mock("@/lib/registrations-store", () => ({ markCheckedIn: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: vi.fn(() => "203.0.113.1"),
  isLockedOut: vi.fn(),
  recordAuthFailure: vi.fn(),
  PIN_AUTH_RATE_LIMIT: { limit: 5, windowSeconds: 900 },
}));

import { cookies } from "next/headers";
import { CHECKIN_SESSION_COOKIE, createOrganiserSessionToken } from "@/lib/auth";
import { getActiveEvent } from "@/lib/events-store";
import { isLockedOut, recordAuthFailure } from "@/lib/rate-limit";
import { markCheckedIn } from "@/lib/registrations-store";
import { POST } from "./route";

const EVENT = { id: "event-1", sessionSecret: "a-real-high-entropy-session-secret" };

function request(body: unknown): Request {
  return new Request("http://localhost/api/checkin/mark", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === CHECKIN_SESSION_COOKIE ? (value !== undefined ? { value } : undefined) : undefined),
  } as never);
}

describe("POST /api/checkin/mark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveEvent).mockResolvedValue(EVENT as never);
    vi.mocked(isLockedOut).mockResolvedValue(false);
    vi.mocked(recordAuthFailure).mockResolvedValue(undefined);
  });

  it("rejects a missing session cookie and records an auth failure", async () => {
    mockCookie(undefined);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
    expect(markCheckedIn).not.toHaveBeenCalled();
  });

  // Regression test for issue #24: a token forged with a guessed/wrong secret — the exact shape
  // of the old vulnerability, where organiser_pin's tiny keyspace made this trivial offline —
  // must still be rejected now that the signing key is a real events.session_secret.
  it("rejects a token signed with the wrong secret", async () => {
    const forged = createOrganiserSessionToken(EVENT.id, "a-guessed-wrong-secret");
    mockCookie(forged);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
    expect(markCheckedIn).not.toHaveBeenCalled();
  });

  it("accepts a real session token and marks the registration checked in", async () => {
    const real = createOrganiserSessionToken(EVENT.id, EVENT.sessionSecret);
    mockCookie(real);
    vi.mocked(markCheckedIn).mockResolvedValue(true);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, matched: true });
    expect(recordAuthFailure).not.toHaveBeenCalled();
  });

  // A legitimate organiser's successful calls never touch the failure counter — this route's
  // real throughput need (one call per attendee scanned) is unaffected by the issue #24 fix.
  it("does not record an auth failure on a successful call", async () => {
    const real = createOrganiserSessionToken(EVENT.id, EVENT.sessionSecret);
    mockCookie(real);
    vi.mocked(markCheckedIn).mockResolvedValue(false);
    await POST(request({ registrationId: "reg-1" }));
    expect(recordAuthFailure).not.toHaveBeenCalled();
  });

  it("returns 429 once locked out, without even checking the cookie", async () => {
    vi.mocked(isLockedOut).mockResolvedValue(true);
    mockCookie(undefined);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(429);
    expect(markCheckedIn).not.toHaveBeenCalled();
  });
});
