import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("./db", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));

beforeEach(() => {
  execute.mockClear();
});

import {
  deleteRegistration,
  getAllRegistrations,
  getPaidAttendees,
  getPaidCount,
  getRegistrationsForPayments,
  getResendSmsTarget,
  getSlotsRemaining,
  insertCompleteRegistration,
  markCheckedIn,
  markPaid,
  updateSmsStatus,
} from "./registrations-store";
import type { CompleteRegistrationInput } from "./complete-registration";

describe("getPaidCount", () => {
  it("scopes the query by event_id and returns the summed headcount", async () => {
    execute.mockResolvedValueOnce({ rows: [{ n: 7 }] });
    const count = await getPaidCount("event-1");
    expect(count).toBe(7);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ args: ["event-1"] }),
    );
  });
});

describe("getSlotsRemaining", () => {
  it("subtracts the paid count from the given event's capacity cap", async () => {
    execute.mockResolvedValueOnce({ rows: [{ n: 40 }] });
    const remaining = await getSlotsRemaining("event-1", 100);
    expect(remaining).toBe(60);
  });
});

describe("insertCompleteRegistration", () => {
  const input: CompleteRegistrationInput = {
    name: "Jane Doe",
    guestCount: 1,
    nextOfKinName: "John Doe",
    nextOfKinContact: "0712345678",
    email: "jane@example.com",
    termsAccepted: true,
    mediaConsent: "yes",
    isTestRow: false,
    custom: { ticketType: "full" },
    proof: { payerPhone: "0798765432", mpesaCode: "QAB1CD2EFG" },
  };

  it("scopes the insert to the given event_id and returns the new row's summary", async () => {
    execute.mockResolvedValueOnce({});
    const result = await insertCompleteRegistration("event-1", input);
    expect(result).toEqual({ id: expect.any(String), name: "Jane Doe", email: "jane@example.com", isTestRow: false });
    const call = execute.mock.calls[0][0];
    expect(call.args[1]).toBe("event-1");
    expect(call.args[9]).toBe(JSON.stringify({ ticketType: "full" }));
  });
});

describe("getPaidAttendees", () => {
  it("scopes the query by event_id and maps checked_in to a boolean", async () => {
    execute.mockResolvedValueOnce({
      rows: [
        { id: "r1", name: "Jane", checked_in: 1 },
        { id: "r2", name: "Jill", checked_in: 0 },
      ],
    });
    const attendees = await getPaidAttendees("event-1");
    expect(attendees).toEqual([
      { id: "r1", name: "Jane", checkedIn: true },
      { id: "r2", name: "Jill", checkedIn: false },
    ]);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["event-1"] }));
  });
});

describe("markCheckedIn", () => {
  it("scopes the update by both id and event_id, returning whether a row matched", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 1 });
    const matched = await markCheckedIn("event-1", "reg-1");
    expect(matched).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ args: ["reg-1", "event-1"] }),
    );
  });

  it("returns false when no row matched (already checked in, or wrong event)", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 0 });
    const matched = await markCheckedIn("event-1", "reg-1");
    expect(matched).toBe(false);
  });
});

describe("updateSmsStatus", () => {
  it("updates the given registration's sms_status", async () => {
    execute.mockResolvedValueOnce({});
    await updateSmsStatus("reg-1", "sent");
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ args: ["sent", "reg-1"] }),
    );
  });
});

describe("getRegistrationsForPayments", () => {
  it("scopes by event_id and parses custom_fields_json into an object", async () => {
    execute.mockResolvedValueOnce({
      rows: [
        {
          id: "r1",
          name: "Jane",
          guest_count: 1,
          custom_fields_json: JSON.stringify({ ticketType: "full" }),
          paid: 1,
          mpesa_code: "ABC123",
          payer_phone: "0712345678",
          sms_status: "sent",
        },
      ],
    });
    const rows = await getRegistrationsForPayments("event-1");
    expect(rows).toEqual([
      {
        id: "r1",
        name: "Jane",
        guestCount: 1,
        customFields: { ticketType: "full" },
        paid: true,
        mpesaCode: "ABC123",
        payerPhone: "0712345678",
        smsStatus: "sent",
      },
    ]);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["event-1"] }));
  });
});

describe("markPaid", () => {
  it("scopes the update by both id and event_id, returning whether a row matched", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 1 });
    const matched = await markPaid("event-1", "reg-1");
    expect(matched).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["reg-1", "event-1"] }));
  });

  it("returns false when no row matched (already paid, or wrong event)", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 0 });
    expect(await markPaid("event-1", "reg-1")).toBe(false);
  });
});

describe("deleteRegistration", () => {
  it("scopes the delete by both id and event_id, returning whether a row was deleted", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 1 });
    const deleted = await deleteRegistration("event-1", "reg-1");
    expect(deleted).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["reg-1", "event-1"] }));
  });
});

describe("getAllRegistrations", () => {
  it("scopes the query by event_id", async () => {
    execute.mockResolvedValueOnce({ rows: [{ id: "r1" }] });
    const rows = await getAllRegistrations("event-1");
    expect(rows).toEqual([{ id: "r1" }]);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["event-1"] }));
  });
});

describe("getResendSmsTarget", () => {
  it("returns the target when a payer_phone exists", async () => {
    execute.mockResolvedValueOnce({
      rows: [{ name: "Jane", payer_phone: "0712345678", is_test_row: 0 }],
    });
    const target = await getResendSmsTarget("event-1", "reg-1");
    expect(target).toEqual({ name: "Jane", payerPhone: "0712345678", isTestRow: false });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ["reg-1", "event-1"] }));
  });

  it("returns null when no matching row exists", async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    expect(await getResendSmsTarget("event-1", "reg-1")).toBeNull();
  });
});
