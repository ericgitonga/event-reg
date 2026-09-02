import { describe, expect, it } from "vitest";
import { matchScannedId } from "./checkin-match";

const attendees = [
  { id: "a1", name: "Wanjiru Kamau", checkedIn: false },
  { id: "a2", name: "Otieno Kamau", checkedIn: true },
];

describe("matchScannedId", () => {
  it("returns not-found for an id not on the list", () => {
    expect(matchScannedId("nope", attendees)).toEqual({ status: "not-found" });
  });

  it("returns matched for a paid, not-yet-checked-in attendee", () => {
    expect(matchScannedId("a1", attendees)).toEqual({ status: "matched", attendee: attendees[0] });
  });

  it("returns already-checked-in for someone already scanned", () => {
    expect(matchScannedId("a2", attendees)).toEqual({
      status: "already-checked-in",
      attendee: attendees[1],
    });
  });
});
