import { describe, expect, it } from "vitest";
import { buildConfirmationMessage } from "./confirmation-message";

describe("buildConfirmationMessage", () => {
  it("includes the registrant's name, the event name, and the formatted event date", () => {
    const message = buildConfirmationMessage("Example Event 2026", "2026-12-31", "Wanjiru Kamau");
    expect(message).toContain("Wanjiru Kamau");
    expect(message).toContain("Example Event 2026");
    expect(message).toContain("31 December 2026");
  });

  it("works for a different event's name and date", () => {
    const message = buildConfirmationMessage("Ngong Hills Hike", "2026-09-19", "Jane Doe");
    expect(message).toContain("Ngong Hills Hike");
    expect(message).toContain("19 September 2026");
  });
});
