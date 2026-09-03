import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { CHECKIN_SESSION_COOKIE, verifyOrganiserSessionToken } from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { markCheckedIn } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

const ROUTE = "checkin-mark";

// Auth is the session cookie only — no PIN in the body — but a *forged* session cookie is still
// a secret-guessing attack in disguise (issue #24: the old organiser_pin-as-HMAC-key scheme made
// forging one an offline computation), so this rate-limits repeated verification *failures* the
// same way verify-pin does. A legitimate organiser's stream of successful calls (this route's
// real throughput need — called once per attendee scanned) never touches the counter, since only
// `recordAuthFailure` increments it, never a successful verification.
export async function POST(request: Request) {
  const event = await getActiveEvent();
  const ip = clientIpFromHeaders(request.headers);
  if (await isLockedOut(ROUTE, ip, PIN_AUTH_RATE_LIMIT)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const cookieStore = await cookies();
  if (!verifyOrganiserSessionToken(cookieStore.get(CHECKIN_SESSION_COOKIE)?.value, event.id, event.sessionSecret)) {
    await recordAuthFailure(ROUTE, ip, PIN_AUTH_RATE_LIMIT);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { registrationId } = await request.json();
  if (typeof registrationId !== "string" || !registrationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const matched = await markCheckedIn(event.id, registrationId);
  // Minimal audit trail for post-event review — route, id, and outcome only, never the session
  // token or any PII.
  console.log(JSON.stringify({ route: "checkin/mark", eventId: event.id, registrationId, matched }));
  return NextResponse.json({ ok: true, matched });
}
