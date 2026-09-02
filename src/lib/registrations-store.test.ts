import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("./db", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));

beforeEach(() => {
  execute.mockClear();
});

import { getPaidCount, getSlotsRemaining, insertCompleteRegistration } from "./registrations-store";
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
