import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import {
  CHECKIN_SESSION_COOKIE,
  CHECKIN_SESSION_MAX_AGE_SECONDS,
  createOrganiserSessionToken,
  verifyOrganiserSessionToken,
  verifyPin,
} from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { getPaidAttendees } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

const ROUTE = "checkin-verify";

export async function POST(request: Request) {
  const event = await getActiveEvent();
  const cookieStore = await cookies();
  const existingSession = cookieStore.get(CHECKIN_SESSION_COOKIE)?.value;

  // Already has a valid session for this event (e.g. checkin/page.tsx's "Refresh list") — skip
  // PIN verification and rate limiting entirely, no need to resend the secret.
  if (verifyOrganiserSessionToken(existingSession, event.id, event.organiserPin)) {
    const attendees = await getPaidAttendees(event.id);
    return NextResponse.json({ ok: true, attendees });
  }

  const ip = clientIpFromHeaders(request.headers);
  if (await isLockedOut(ROUTE, ip, PIN_AUTH_RATE_LIMIT)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const { pin } = await request.json().catch(() => ({ pin: undefined }));
  if (!verifyPin(pin, event.organiserPin)) {
    await recordAuthFailure(ROUTE, ip, PIN_AUTH_RATE_LIMIT);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const attendees = await getPaidAttendees(event.id);
  const response = NextResponse.json({ ok: true, attendees });
  response.cookies.set(CHECKIN_SESSION_COOKIE, createOrganiserSessionToken(event.id, event.organiserPin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CHECKIN_SESSION_MAX_AGE_SECONDS,
    path: "/api/checkin",
  });
  return response;
}
