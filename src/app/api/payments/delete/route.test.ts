import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependencies never actually load — same pattern as
// checkin/mark/route.test.ts. `@/lib/auth` is deliberately NOT mocked: the real
// createOrganiserSessionToken/verifyOrganiserSessionToken are exactly what's under test here
// (issue #24).
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/events-store", () => ({ getActiveEvent: vi.fn() }));
vi.mock("@/lib/registrations-store", () => ({ deleteRegistration: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: vi.fn(() => "203.0.113.1"),
  isLockedOut: vi.fn(),
  recordAuthFailure: vi.fn(),
  PIN_AUTH_RATE_LIMIT: { limit: 5, windowSeconds: 900 },
}));

import { cookies } from "next/headers";
import { createOrganiserSessionToken, PAYMENTS_SESSION_COOKIE } from "@/lib/auth";
import { getActiveEvent } from "@/lib/events-store";
import { isLockedOut, recordAuthFailure } from "@/lib/rate-limit";
import { deleteRegistration } from "@/lib/registrations-store";
import { POST } from "./route";

const EVENT = { id: "event-1", sessionSecret: "a-real-high-entropy-session-secret" };

function request(body: unknown): Request {
  return new Request("http://localhost/api/payments/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === PAYMENTS_SESSION_COOKIE ? (value !== undefined ? { value } : undefined) : undefined),
  } as never);
}

describe("POST /api/payments/delete", () => {
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
    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  // Regression test for issue #24 — see checkin/mark/route.test.ts for the full rationale. This
  // is the route with the most severe consequence if forgeable: irreversible deletion.
  it("rejects a token signed with the wrong secret", async () => {
    const forged = createOrganiserSessionToken(EVENT.id, "a-guessed-wrong-secret");
    mockCookie(forged);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  it("accepts a real session token and deletes the registration", async () => {
    const real = createOrganiserSessionToken(EVENT.id, EVENT.sessionSecret);
    mockCookie(real);
    vi.mocked(deleteRegistration).mockResolvedValue(true);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, deleted: true });
    expect(recordAuthFailure).not.toHaveBeenCalled();
  });

  it("returns 429 once locked out, without even checking the cookie", async () => {
    vi.mocked(isLockedOut).mockResolvedValue(true);
    mockCookie(undefined);
    const res = await POST(request({ registrationId: "reg-1" }));
    expect(res.status).toBe(429);
    expect(deleteRegistration).not.toHaveBeenCalled();
  });
});
