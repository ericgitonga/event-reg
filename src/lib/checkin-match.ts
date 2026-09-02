export type CachedAttendee = { id: string; name: string; checkedIn: boolean };

export type MatchResult =
  | { status: "not-found" }
  | { status: "already-checked-in"; attendee: CachedAttendee }
  | { status: "matched"; attendee: CachedAttendee };

export function matchScannedId(scannedId: string, attendees: CachedAttendee[]): MatchResult {
  const attendee = attendees.find((a) => a.id === scannedId);
  if (!attendee) return { status: "not-found" };
  if (attendee.checkedIn) return { status: "already-checked-in", attendee };
  return { status: "matched", attendee };
}
