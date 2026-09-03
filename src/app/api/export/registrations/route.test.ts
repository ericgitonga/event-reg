import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependencies never actually load — same pattern as
// checkin/mark/route.test.ts. `@/lib/auth` is deliberately NOT mocked: the real `verifyPin` is
// exactly what's under test here.
vi.mock("@/lib/events-store", () => ({ getActiveEvent: vi.fn() }));
vi.mock("@/lib/registrations-store", () => ({ getAllRegistrations: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: vi.fn(() => "203.0.113.1"),
  isLockedOut: vi.fn(),
  recordAuthFailure: vi.fn(),
  PIN_AUTH_RATE_LIMIT: { limit: 5, windowSeconds: 900 },
}));

import { getActiveEvent } from "@/lib/events-store";
import { isLockedOut, recordAuthFailure } from "@/lib/rate-limit";
import { getAllRegistrations } from "@/lib/registrations-store";
import { POST } from "./route";

const EVENT = { id: "event-1", organiserPin: "1234" };

function request(body?: unknown): Request {
  const init: RequestInit = { method: "POST", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request("http://localhost/api/export/registrations", init);
}

describe("POST /api/export/registrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveEvent).mockResolvedValue(EVENT as never);
    vi.mocked(isLockedOut).mockResolvedValue(false);
    vi.mocked(recordAuthFailure).mockResolvedValue(undefined);
    vi.mocked(getAllRegistrations).mockResolvedValue([]);
  });

  it("returns 429 once locked out, without checking the PIN", async () => {
    vi.mocked(isLockedOut).mockResolvedValue(true);
    const res = await POST(request({ pin: EVENT.organiserPin }));
    expect(res.status).toBe(429);
    expect(getAllRegistrations).not.toHaveBeenCalled();
  });

  it("rejects the wrong PIN and records an auth failure", async () => {
    const res = await POST(request({ pin: "0000" }));
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
    expect(getAllRegistrations).not.toHaveBeenCalled();
  });

  it("accepts the correct PIN and returns a CSV attachment", async () => {
    vi.mocked(getAllRegistrations).mockResolvedValue([
      { id: "r1", name: "Jane", custom_fields_json: "{}" },
    ]);
    const res = await POST(request({ pin: EVENT.organiserPin }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.text();
    expect(body).toContain("Jane");
  });

  // Regression test for issue #30 (Low, extras/security-audit.md finding L1): a malformed body
  // used to throw an unhandled exception here (500) instead of the intended 401, unlike
  // checkin/verify-pin and payments/verify-pin, which already guarded against this.
  it("treats a malformed JSON body as a wrong/missing PIN, not a thrown exception", async () => {
    const malformed = new Request("http://localhost/api/export/registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(malformed);
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledOnce();
  });

  it("treats a body with no pin field the same way", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(401);
  });
});
