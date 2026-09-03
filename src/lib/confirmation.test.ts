import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so an isTestRow assertion can prove the channels are never even attempted, not just
// that they happen to return false — the "unconfigured" tests below don't need this, since
// SASASIGNAL_API_TOKEN/RESEND_API_KEY are never set in the unit-test job anyway.
vi.mock("@/lib/sms", () => ({ sendSmsConfirmation: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmailConfirmation: vi.fn() }));
// registrations-store touches @/lib/db, which throws at import time without TURSO_* env vars —
// mocked the same way events-store.test.ts/registrations-store.test.ts mock it.
vi.mock("@/lib/registrations-store", () => ({
  getResendSmsTarget: vi.fn(),
  updateSmsStatus: vi.fn(),
}));

import { sendEmailConfirmation } from "@/lib/email";
import { getResendSmsTarget, updateSmsStatus } from "@/lib/registrations-store";
import { sendSmsConfirmation } from "@/lib/sms";
import { resendSmsConfirmation, sendConfirmation } from "./confirmation";

beforeEach(() => {
  vi.mocked(sendSmsConfirmation).mockReset().mockResolvedValue(false);
  vi.mocked(sendEmailConfirmation).mockReset().mockResolvedValue(false);
  vi.mocked(getResendSmsTarget).mockReset();
  vi.mocked(updateSmsStatus).mockReset().mockResolvedValue(undefined);
});

const BASE_INPUT = {
  registrationId: "test-id",
  eventName: "Example Event 2026",
  eventDate: "2026-12-31",
  name: "Test Registrant",
  phone: "0712345678",
};

describe("sendConfirmation", () => {
  it("no-ops every channel when no provider credentials are configured", async () => {
    const result = await sendConfirmation(BASE_INPUT);
    expect(result).toEqual({ smsSent: false, emailSent: false });
  });

  it("still no-ops the email channel when an email is supplied but unconfigured", async () => {
    const result = await sendConfirmation({ ...BASE_INPUT, email: "test@example.com" });
    expect(result.emailSent).toBe(false);
  });

  it("skips the email channel entirely when no email is supplied", async () => {
    const result = await sendConfirmation(BASE_INPUT);
    expect(result.emailSent).toBe(false);
    expect(sendEmailConfirmation).not.toHaveBeenCalled();
  });

  it("skips every channel for a test row without even attempting a send, even with an email supplied", async () => {
    const result = await sendConfirmation({ ...BASE_INPUT, email: "test@example.com", isTestRow: true });
    expect(result).toEqual({ smsSent: false, emailSent: false });
    expect(sendSmsConfirmation).not.toHaveBeenCalled();
    expect(sendEmailConfirmation).not.toHaveBeenCalled();
  });

  it("passes the event name/date and registrant name into the SMS message", async () => {
    await sendConfirmation(BASE_INPUT);
    expect(sendSmsConfirmation).toHaveBeenCalledWith(
      "0712345678",
      expect.stringContaining("Example Event 2026"),
    );
  });
});

describe("resendSmsConfirmation", () => {
  it("reports not_found when the row has no payment proof submitted yet", async () => {
    vi.mocked(getResendSmsTarget).mockResolvedValue(null);
    const result = await resendSmsConfirmation("event-1", "Example Event", "2026-12-31", "missing-id");
    expect(result).toEqual({ status: "not_found" });
    expect(sendSmsConfirmation).not.toHaveBeenCalled();
    expect(updateSmsStatus).not.toHaveBeenCalled();
  });

  it("skips a test row without attempting a real send, and records 'skipped'", async () => {
    vi.mocked(getResendSmsTarget).mockResolvedValue({
      name: "Test Registrant",
      payerPhone: "0712345678",
      isTestRow: true,
    });
    const result = await resendSmsConfirmation("event-1", "Example Event", "2026-12-31", "test-row-id");
    expect(result).toEqual({ status: "skipped" });
    expect(sendSmsConfirmation).not.toHaveBeenCalled();
    expect(updateSmsStatus).toHaveBeenCalledWith("test-row-id", "skipped");
  });

  it("records 'sent' and returns it when the real send succeeds", async () => {
    vi.mocked(getResendSmsTarget).mockResolvedValue({
      name: "Wanjiru Kamau",
      payerPhone: "0712345678",
      isTestRow: false,
    });
    vi.mocked(sendSmsConfirmation).mockResolvedValue(true);
    const result = await resendSmsConfirmation("event-1", "Example Event", "2026-12-31", "real-id");
    expect(result).toEqual({ status: "sent" });
    expect(updateSmsStatus).toHaveBeenCalledWith("real-id", "sent");
  });

  it("records 'failed' and returns it when the real send fails", async () => {
    vi.mocked(getResendSmsTarget).mockResolvedValue({
      name: "Wanjiru Kamau",
      payerPhone: "0712345678",
      isTestRow: false,
    });
    vi.mocked(sendSmsConfirmation).mockResolvedValue(false);
    const result = await resendSmsConfirmation("event-1", "Example Event", "2026-12-31", "real-id");
    expect(result).toEqual({ status: "failed" });
    expect(updateSmsStatus).toHaveBeenCalledWith("real-id", "failed");
  });
});
