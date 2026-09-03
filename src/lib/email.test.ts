import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmailConfirmation } from "./email";

describe("sendEmailConfirmation", () => {
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;

  afterEach(() => {
    process.env.RESEND_API_KEY = ORIGINAL_KEY;
  });

  it("returns false when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmailConfirmation("jane@example.com", "Jane Doe", "data:image/png;base64,abc");
    expect(result).toBe(false);
  });

  it("returns false even when RESEND_API_KEY is set — sending isn't implemented yet", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const result = await sendEmailConfirmation("jane@example.com", "Jane Doe", "data:image/png;base64,abc");
    expect(result).toBe(false);
  });

  // Regression coverage for issue #25 (High, extras/security-audit.md finding H1): both branches
  // used to log the recipient's email and name — the "no key configured" branch is what
  // actually runs in production today.
  describe("never logs the recipient's email or name (issue #25)", () => {
    function assertNoPiiLogged(logSpy: ReturnType<typeof vi.spyOn>) {
      for (const call of logSpy.mock.calls) {
        const line = call.join(" ");
        expect(line).not.toContain("jane@example.com");
        expect(line).not.toContain("Jane Doe");
      }
      expect(logSpy).toHaveBeenCalled(); // sanity: something was actually logged
    }

    it("on the no-API-key branch", async () => {
      delete process.env.RESEND_API_KEY;
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendEmailConfirmation("jane@example.com", "Jane Doe", "data:image/png;base64,abc");
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });

    it("on the not-yet-implemented branch", async () => {
      process.env.RESEND_API_KEY = "test-key";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await sendEmailConfirmation("jane@example.com", "Jane Doe", "data:image/png;base64,abc");
      assertNoPiiLogged(logSpy);
      logSpy.mockRestore();
    });
  });
});
