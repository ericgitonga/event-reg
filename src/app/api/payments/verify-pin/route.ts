import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import {
  createOrganiserSessionToken,
  PAYMENTS_SESSION_COOKIE,
  PAYMENTS_SESSION_MAX_AGE_SECONDS,
  verifyOrganiserSessionToken,
  verifyPin,
} from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { getRegistrationsForPayments } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

const ROUTE = "payments-verify";

export async function POST(request: Request) {
  const event = await getActiveEvent();
  const cookieStore = await cookies();
  const existingSession = cookieStore.get(PAYMENTS_SESSION_COOKIE)?.value;

  // Already has a valid session for this event (e.g. the payments page's "Refresh list") — skip
  // PIN verification and rate limiting entirely, no need to resend the secret.
  if (verifyOrganiserSessionToken(existingSession, event.id, event.organiserPin)) {
    const registrations = await getRegistrationsForPayments(event.id);
    return NextResponse.json({ ok: true, registrations });
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

  const registrations = await getRegistrationsForPayments(event.id);
  const response = NextResponse.json({ ok: true, registrations });
  response.cookies.set(PAYMENTS_SESSION_COOKIE, createOrganiserSessionToken(event.id, event.organiserPin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: PAYMENTS_SESSION_MAX_AGE_SECONDS,
    path: "/api/payments",
  });
  return response;
}
