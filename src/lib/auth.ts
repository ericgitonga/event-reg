import { createHmac, timingSafeEqual } from "node:crypto";

// Constant-time string comparison — a plain `!==` short-circuits at the first mismatched
// character, letting response latency leak how many leading characters of a guess were
// correct. `timingSafeEqual` requires equal-length buffers; the length check below is the
// only shortcut left, which leaks only whether the *lengths* match, not any content.
export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// `expectedPin` is the active event's own `organiserPin` (events.organiser_pin), not a shared
// env var — per generalize.md §7 and the client's 2026-09-02 decision ("Each instance should
// have its own PIN").
export function verifyPin(pin: unknown, expectedPin: string): boolean {
  if (typeof pin !== "string") return false;
  return safeEqual(pin, expectedPin);
}

// CRON_SECRET stays a deployment-level env var, not per-event — an infrastructure concern
// (which cron job may run), not an event concern (generalize.md §6).
export function verifyCronSecret(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !authHeader) return false;
  return safeEqual(authHeader, `Bearer ${expected}`);
}

// Short-lived, server-issued organiser session (ported from busherian-hike issue #27). Stateless:
// an HMAC-signed expiry, keyed on the active event's own PIN (so rotating that event's PIN also
// invalidates every existing session for it) — no separate session table/store. The token also
// carries which event it was issued for, so a session unlocked against one event's PIN can never
// be replayed against a different event's data if the active event ever changes mid-session
// (generalize.md §7 — the load-bearing change from busherian-hike's single-event version, which
// only ever had one event to worry about).
// Shared by every PIN-gated organiser area (check-in, payments) via its own separately-scoped
// cookie; the token itself doesn't encode which area it's for, only that the PIN was verified
// within the TTL, for which event.
export const CHECKIN_SESSION_COOKIE = "checkin_session";
export const PAYMENTS_SESSION_COOKIE = "payments_session";
const ORGANISER_SESSION_TTL_SECONDS = 4 * 60 * 60; // long enough to span one event day
export const CHECKIN_SESSION_MAX_AGE_SECONDS = ORGANISER_SESSION_TTL_SECONDS;
export const PAYMENTS_SESSION_MAX_AGE_SECONDS = ORGANISER_SESSION_TTL_SECONDS;

function signSessionPayload(eventId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${eventId}.${expiresAt}`).digest("hex");
}

export function createOrganiserSessionToken(eventId: string, organiserPin: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ORGANISER_SESSION_TTL_SECONDS;
  return `${eventId}.${expiresAt}.${signSessionPayload(eventId, expiresAt, organiserPin)}`;
}

export function verifyOrganiserSessionToken(
  token: string | undefined | null,
  eventId: string,
  organiserPin: string,
): boolean {
  if (!token) return false;

  const [tokenEventId, expiresAtRaw, signature] = token.split(".");
  if (!tokenEventId || !expiresAtRaw || !signature) return false;
  if (tokenEventId !== eventId) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt)) return false;
  if (!safeEqual(signature, signSessionPayload(tokenEventId, expiresAt, organiserPin))) return false;

  return expiresAt > Math.floor(Date.now() / 1000);
}
