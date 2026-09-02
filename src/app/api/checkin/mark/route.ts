import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { CHECKIN_SESSION_COOKIE, verifyOrganiserSessionToken } from "@/lib/auth";
import { markCheckedIn } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

// Auth is the session cookie only — no PIN in the body, so no rate limiting is needed here
// either: there's no secret to guess against a signed session token the way there was against a
// PIN. Called once per attendee scanned by an already-authenticated organiser, so this needs to
// support real check-in throughput with no artificial cap.
export async function POST(request: Request) {
  const event = await getActiveEvent();
  const cookieStore = await cookies();
  if (!verifyOrganiserSessionToken(cookieStore.get(CHECKIN_SESSION_COOKIE)?.value, event.id, event.organiserPin)) {
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
