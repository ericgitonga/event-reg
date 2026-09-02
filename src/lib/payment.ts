// Event-scoped, unlike busherian-hike's hardcoded PER_HIKER_FEE_KES — perHeadFee comes from the
// active event's own `events` row. Guests pay the same per-head rate as the registrant (ported
// from busherian-hike issue #80): the registrant plus their guestCount, not guestCount alone.
export function totalFee(perHeadFee: number, guestCount: number): number {
  return perHeadFee * (1 + guestCount);
}
