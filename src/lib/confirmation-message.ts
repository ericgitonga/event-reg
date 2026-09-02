// ISO date (e.g. "2026-09-19") -> "19 September 2026". A fixed UTC interpretation and en-GB
// day-month-year ordering avoids the message's date shifting a day depending on the server's
// local timezone.
function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Event name/date come from the active event's own row (generalize.md §6) rather than being
// baked into the string, the way busherian-hike's version named "Ngong Hills Hike & After Party"
// directly.
export function buildConfirmationMessage(eventName: string, eventDate: string, name: string): string {
  return `Hi ${name}, your registration for ${eventName} (${formatEventDate(eventDate)}) is confirmed. See you there!`;
}
