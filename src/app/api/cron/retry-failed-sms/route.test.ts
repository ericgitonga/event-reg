import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependency never actually loads — same pattern as
// registrations-store.test.ts/auth.test.ts elsewhere in this project.
vi.mock("@/lib/registrations-store", () => ({
  getFailedSmsRegistrations: vi.fn(),
}));
vi.mock("@/lib/confirmation", () => ({
  resendSmsConfirmation: vi.fn(),
}));

import { resendSmsConfirmation } from "@/lib/confirmation";
import { getFailedSmsRegistrations, type FailedSmsRow } from "@/lib/registrations-store";
import { GET } from "./route";

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function request(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/retry-failed-sms", { headers });
}

const ROW_A: FailedSmsRow = {
  eventId: "event-a",
  eventName: "Event A",
  eventDate: "2026-09-19",
  registrationId: "reg-a",
  name: "Jane",
  payerPhone: "0712345678",
};
const ROW_B: FailedSmsRow = {
  eventId: "event-b",
  eventName: "Event B",
  eventDate: "2026-12-01",
  registrationId: "reg-b",
  name: "Jill",
  payerPhone: "0798765432",
};

describe("GET /api/cron/retry-failed-sms", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    vi.mocked(getFailedSmsRegistrations).mockReset();
    vi.mocked(resendSmsConfirmation).mockReset();
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(getFailedSmsRegistrations).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await GET(request("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(getFailedSmsRegistrations).not.toHaveBeenCalled();
  });

  it("retries every failed row across every event, not just one", async () => {
    vi.mocked(getFailedSmsRegistrations).mockResolvedValue([ROW_A, ROW_B]);
    vi.mocked(resendSmsConfirmation).mockResolvedValue({ status: "sent" });

    const res = await GET(request("Bearer test-cron-secret"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ retried: 2, succeeded: 2, stillFailed: 0 });
    expect(resendSmsConfirmation).toHaveBeenNthCalledWith(1, "event-a", "Event A", "2026-09-19", "reg-a");
    expect(resendSmsConfirmation).toHaveBeenNthCalledWith(2, "event-b", "Event B", "2026-12-01", "reg-b");
  });

  it("reports rows that fail again as stillFailed rather than dropping them", async () => {
    vi.mocked(getFailedSmsRegistrations).mockResolvedValue([ROW_A]);
    vi.mocked(resendSmsConfirmation).mockResolvedValue({ status: "failed" });

    const res = await GET(request("Bearer test-cron-secret"));

    await expect(res.json()).resolves.toEqual({ retried: 1, succeeded: 0, stillFailed: 1 });
  });

  it("reports zero retried when there's nothing to do", async () => {
    vi.mocked(getFailedSmsRegistrations).mockResolvedValue([]);

    const res = await GET(request("Bearer test-cron-secret"));

    await expect(res.json()).resolves.toEqual({ retried: 0, succeeded: 0, stillFailed: 0 });
    expect(resendSmsConfirmation).not.toHaveBeenCalled();
  });
});
