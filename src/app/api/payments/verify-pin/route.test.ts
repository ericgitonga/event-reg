import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependencies never actually load — same pattern as
// checkin/verify-pin/route.test.ts. `@/lib/auth` is deliberately NOT mocked: the real
// createOrganiserSessionToken/verifyOrganiserSessionToken/verifyPin are exactly what's under
// test here (issue #24).
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/events-store", () => ({ getActiveEvent: vi.fn() }));
vi.mock("@/lib/registrations-store", () => ({ getRegistrationsForPayments: vi.fn() }));
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
import { getRegistrationsForPayments } from "@/lib/registrations-store";
import { POST } from "./route";

const EVENT = { id: "event-1", organiserPin: "1234", sessionSecret: "a-real-high-entropy-session-secret" };

function request(body: unknown): Request {
  return new Request("http://localhost/api/payments/verify-pin", {
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

describe("POST /api/payments/verify-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveEvent).mockResolvedValue(EVENT as never);
    vi.mocked(isLockedOut).mockResolvedValue(false);
    vi.mocked(recordAuthFailure).mockResolvedValue(undefined);
    vi.mocked(getRegistrationsForPayments).mockResolvedValue([]);
  });

  it("skips PIN verification and rate limiting entirely when an existing valid session is present", async () => {
    const real = createOrganiserSessionToken(EVENT.id, EVENT.sessionSecret);
    mockCookie(real);
    const res = await POST(request({}));
    expect(res.status).toBe(200);
    expect(isLockedOut).not.toHaveBeenCalled();
    expect(getRegistrationsForPayments).toHaveBeenCalledWith(EVENT.id);
  });

  it("returns 429 once locked out, without checking the PIN", async () => {
    mockCookie(undefined);
    vi.mocked(isLockedOut).mockResolvedValue(true);
    const res = await POST(request({ pin: EVENT.organiserPin }));
    expect(res.status).toBe(429);
    expect(getRegistrationsForPayments).not.toHaveBeenCalled();
  });

  it("rejects the wrong PIN and records an auth failure", async () => {
    mockCookie(undefined);
    const res = await POST(request({ pin: "0000" }));
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
  });

  it("accepts the correct PIN and issues a session cookie that is httpOnly and sameSite=strict", async () => {
    mockCookie(undefined);
    const res = await POST(request({ pin: EVENT.organiserPin }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${PAYMENTS_SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
  });

  it("tolerates a malformed JSON body without throwing", async () => {
    mockCookie(undefined);
    const malformed = new Request("http://localhost/api/payments/verify-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    await expect(POST(malformed)).resolves.toBeDefined();
  });
});
