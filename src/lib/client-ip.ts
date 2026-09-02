// Split out of rate-limit.ts so this pure function can be unit-tested without importing
// @/lib/db — db.ts throws at module load if TURSO_DATABASE_URL/TURSO_AUTH_TOKEN aren't set,
// which the unit-test CI job deliberately never sets.

// Vercel's edge terminates the client TCP connection itself and sets these headers from the
// actual peer address, overwriting any client-supplied value of the same name — safe to trust
// directly, without further validation, for rate-limiting purposes.
export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
