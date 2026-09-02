import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { PAYMENTS_SESSION_COOKIE, verifyOrganiserSessionToken } from "@/lib/auth";
import { deleteRegistration } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

// Auth is the session cookie only, same reasoning as payments/mark and payments/resend-sms — no
// PIN in the body, so no rate limiting is needed here either. Irreversible, so the confirmation
// step lives entirely in the UI (/payments requires a second click before this ever fires) —
// this route itself just does the delete once asked.
export async function POST(request: Request) {
  const event = await getActiveEvent();
  const cookieStore = await cookies();
  if (!verifyOrganiserSessionToken(cookieStore.get(PAYMENTS_SESSION_COOKIE)?.value, event.id, event.organiserPin)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { registrationId } = await request.json();
  if (typeof registrationId !== "string" || !registrationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const deleted = await deleteRegistration(event.id, registrationId);
  // Minimal audit trail, same shape as payments/mark — route, id, and outcome only, never PII.
  console.log(JSON.stringify({ route: "payments/delete", eventId: event.id, registrationId, deleted }));
  return NextResponse.json({ ok: true, deleted });
}
