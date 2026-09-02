// Event-scoped, unlike busherian-hike's global CAPACITY_CAP constant — each event's
// `capacityCap` comes from its own `events` row (src/lib/events-store.ts).
export function computeSlotsRemaining(capacityCap: number, paidCount: number): number {
  return Math.max(0, capacityCap - paidCount);
}
