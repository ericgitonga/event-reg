import { describe, expect, it } from "vitest";
import { computeSlotsRemaining } from "./capacity";

describe("computeSlotsRemaining", () => {
  it("returns the full cap when nobody has paid", () => {
    expect(computeSlotsRemaining(100, 0)).toBe(100);
  });

  it("subtracts the paid count from the cap", () => {
    expect(computeSlotsRemaining(100, 3)).toBe(97);
  });

  it("clamps at zero once the paid count reaches the cap", () => {
    expect(computeSlotsRemaining(100, 100)).toBe(0);
  });

  it("never goes negative if the paid count somehow exceeds the cap", () => {
    expect(computeSlotsRemaining(100, 105)).toBe(0);
  });

  it("works for a different event's differently-sized cap", () => {
    expect(computeSlotsRemaining(30, 10)).toBe(20);
  });
});
