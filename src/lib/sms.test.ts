import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SASASIGNAL_SENDER_ID, sendSmsConfirmation, toSasaSignalPhone } from "./sms";

describe("toSasaSignalPhone", () => {
  it("converts a bare-0 Kenyan number to +254 form", () => {
    expect(toSasaSignalPhone("0712345678")).toBe("+254712345678");
  });

  it("leaves an already-+254 number unchanged", () => {
    expect(toSasaSignalPhone("+254712345678")).toBe("+254712345678");
  });
});

describe("sendSmsConfirmation", () => {
  const ORIGINAL_TOKEN = process.env.SASASIGNAL_API_TOKEN;

  afterEach(() => {
    process.env.SASASIGNAL_API_TOKEN = ORIGINAL_TOKEN;
    vi.unstubAllGlobals();
  });

  it("no-ops without hitting the network when SASASIGNAL_API_TOKEN is unset", async () => {
    delete process.env.SASASIGNAL_API_TOKEN;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendSmsConfirmation("0712345678", "hello");

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe("with SASASIGNAL_API_TOKEN set", () => {
    beforeEach(() => {
      process.env.SASASIGNAL_API_TOKEN = "test-token";
    });

    it("posts the sender id, message, and normalized recipient with a bearer token", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await sendSmsConfirmation("0712345678", "hello there");

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://sasasignal.com/api/v1/sms/transactional/send");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer test-token");
      expect(init.headers["Idempotency-Key"]).toBeTruthy();

      const body = init.body as FormData;
      expect(body.get("sender_id")).toBe(SASASIGNAL_SENDER_ID);
      expect(body.get("message")).toBe("hello there");
      expect(body.get("recipient")).toBe("+254712345678");
    });

    it("uses a fresh Idempotency-Key per call", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);

      await sendSmsConfirmation("0712345678", "one");
      await sendSmsConfirmation("0712345678", "two");

      const key1 = fetchSpy.mock.calls[0][1].headers["Idempotency-Key"];
      const key2 = fetchSpy.mock.calls[1][1].headers["Idempotency-Key"];
      expect(key1).not.toBe(key2);
    });

    it("returns false when SasaSignal responds with a non-OK status", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await sendSmsConfirmation("0712345678", "hello");
      expect(result).toBe(false);
    });

    it("returns false when the request throws", async () => {
      const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await sendSmsConfirmation("0712345678", "hello");
      expect(result).toBe(false);
    });
  });

  // Regression coverage for issue #25 (High, extras/security-audit.md finding H1): every branch
  // used to log the recipient's phone number, and the skipped/failed branches also logged the
  // full message text (which embeds the registrant's name) or the provider's raw response.
  describe("never logs the phone number or message content (issue #25)", () => {
    const PHONE = "0712345678";
    const MESSAGE = "Hi Jane Doe, your registration for Test Event is confirmed. See you there!";

    function assertNoPiiLogged(logSpy: ReturnType<typeof vi.spyOn>) {
      for (const call of logSpy.mock.calls) {
        const line = call.join(" ");
        expect(line).not.toContain(PHONE);
        expect(line).not.toContain("Jane Doe");
        expect(line).not.toContain(MESSAGE);
      }
      expect(logSpy).toHaveBeenCalled(); // sanity: something was actually logged
    }

    it("on the skipped (no API token) branch — the branch that actually runs in production today", async () => {
      delete process.env.SASASIGNAL_API_TOKEN;
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendSmsConfirmation(PHONE, MESSAGE);
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });

    it("on the accepted branch", async () => {
      process.env.SASASIGNAL_API_TOKEN = "test-token";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("recipient echoed back here", { status: 200 })));
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendSmsConfirmation(PHONE, MESSAGE);
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });

    it("on the provider-failure branch", async () => {
      process.env.SASASIGNAL_API_TOKEN = "test-token";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("recipient echoed back here", { status: 500 })));
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendSmsConfirmation(PHONE, MESSAGE);
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });

    it("on the request-threw branch", async () => {
      process.env.SASASIGNAL_API_TOKEN = "test-token";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendSmsConfirmation(PHONE, MESSAGE);
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });
  });
});
