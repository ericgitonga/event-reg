import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this route's DB dependency never actually loads — same pattern as
// registrations-store.test.ts/auth.test.ts elsewhere in this project.
vi.mock("@/lib/registrations-store", () => ({
  purgeContactFields: vi.fn(),
}));

import { purgeContactFields } from "@/lib/registrations-store";
import { GET } from "./route";

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function request(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/purge-contact-fields", { headers });
}

describe("GET /api/cron/purge-contact-fields", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    vi.mocked(purgeContactFields).mockReset();
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(purgeContactFields).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await GET(request("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(purgeContactFields).not.toHaveBeenCalled();
  });

  it("purges and reports the count with the correct secret — the per-event retention check happens inside purgeContactFields' own query, not this route", async () => {
    vi.mocked(purgeContactFields).mockResolvedValue(3);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ purged: 3 });
    expect(purgeContactFields).toHaveBeenCalledOnce();
  });

  it("reports zero when nothing is past retention yet, without treating that as an error", async () => {
    vi.mocked(purgeContactFields).mockResolvedValue(0);
    const res = await GET(request("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ purged: 0 });
  });
});
