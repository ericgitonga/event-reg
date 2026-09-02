import { NextResponse } from "next/server";
import { CHECKIN_SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Explicit "lock this device" control — clears the session cookie server-side so a
// shared/borrowed phone can't retain check-in access after handing it back, without needing to
// wait out the session's own expiry.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CHECKIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/api/checkin",
  });
  return response;
}
