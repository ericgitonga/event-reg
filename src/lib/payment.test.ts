import { describe, expect, it } from "vitest";
import { totalFee } from "./payment";

describe("totalFee", () => {
  it("charges just the per-head fee with no guests", () => {
    expect(totalFee(1500, 0)).toBe(1500);
  });

  it("charges the same per-head rate for each guest", () => {
    expect(totalFee(1500, 2)).toBe(4500);
  });

  it("works for a different event's fee", () => {
    expect(totalFee(1000, 3)).toBe(4000);
  });
});
