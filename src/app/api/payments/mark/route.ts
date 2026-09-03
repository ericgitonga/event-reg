import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { PAYMENTS_SESSION_COOKIE, verifyOrganiserSessionToken } from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { markPaid } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

const ROUTE = "payments-mark";

// Auth is the session cookie only, same reasoning as checkin/mark — rate-limits repeated
// verification *failures* (a forged-cookie guessing attack, issue #24), never a legitimate
// organiser's successful calls, since only a failure increments the counter.
export async function POST(request: Request) {
  const event = await getActiveEvent();
  const ip = clientIpFromHeaders(request.headers);
  if (await isLockedOut(ROUTE, ip, PIN_AUTH_RATE_LIMIT)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const cookieStore = await cookies();
  if (!verifyOrganiserSessionToken(cookieStore.get(PAYMENTS_SESSION_COOKIE)?.value, event.id, event.sessionSecret)) {
    await recordAuthFailure(ROUTE, ip, PIN_AUTH_RATE_LIMIT);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { registrationId } = await request.json();
  if (typeof registrationId !== "string" || !registrationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const matched = await markPaid(event.id, registrationId);
  // Minimal audit trail for post-event review, same shape as checkin/mark's — route, id, and
  // outcome only, never the session token or any PII.
  console.log(JSON.stringify({ route: "payments/mark", eventId: event.id, registrationId, matched }));
  return NextResponse.json({ ok: true, matched });
}
