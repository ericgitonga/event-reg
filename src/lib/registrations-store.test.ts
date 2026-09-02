import { describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("./db", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));

import { getPaidCount, getSlotsRemaining } from "./registrations-store";

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
