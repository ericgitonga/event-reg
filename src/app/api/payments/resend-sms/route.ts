import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { PAYMENTS_SESSION_COOKIE, verifyOrganiserSessionToken } from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { resendSmsConfirmation } from "@/lib/confirmation";

export const dynamic = "force-dynamic";

const ROUTE = "payments-resend-sms";

// Auth is the session cookie only, same reasoning as payments/mark — rate-limits repeated
// verification *failures* (a forged-cookie guessing attack, issue #24), never a legitimate
// organiser's successful calls.
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

  const result = await resendSmsConfirmation(event.id, event.name, event.eventDate, registrationId);
  if (result.status === "not_found") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Same minimal audit trail shape as payments/mark — route, id, and outcome only, never PII.
  console.log(
    JSON.stringify({ route: "payments/resend-sms", eventId: event.id, registrationId, status: result.status }),
  );
  return NextResponse.json({ ok: true, status: result.status });
}
