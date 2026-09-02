import { db } from "@/lib/db";
import { computeSlotsRemaining } from "@/lib/capacity";

// Headcount, not row count — a paid registration's guests count against capacity the same as
// the registrant themselves (ported from busherian-hike issue #82). Scoped by event_id since
// this database can hold more than one event's rows (generalize.md §2/§3).
export async function getPaidCount(eventId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COALESCE(SUM(1 + guest_count), 0) as n FROM registrations WHERE event_id = ? AND paid = 1",
    args: [eventId],
  });
  return Number(result.rows[0].n);
}

export async function getSlotsRemaining(eventId: string, capacityCap: number): Promise<number> {
  return computeSlotsRemaining(capacityCap, await getPaidCount(eventId));
}
