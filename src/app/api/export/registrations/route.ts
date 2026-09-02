import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events-store";
import { verifyPin } from "@/lib/auth";
import { clientIpFromHeaders, isLockedOut, PIN_AUTH_RATE_LIMIT, recordAuthFailure } from "@/lib/rate-limit";
import { flattenCustomFields, toCsv } from "@/lib/csv";
import { getAllRegistrations } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

const BASE_COLUMNS = [
  "id",
  "event_id",
  "name",
  "guest_count",
  "next_of_kin_name",
  "next_of_kin_contact",
  "email",
  "paid",
  "paid_at",
  "checked_in",
  "checked_in_at",
  "is_test_row",
  "mpesa_code",
  "payer_phone",
  "sms_status",
  "terms_accepted",
  "media_consent",
  "created_at",
];

const ROUTE = "export";

// A fresh PIN re-check on every export, not the payments session cookie — this is the most
// sensitive endpoint (full next-of-kin PII), so it re-verifies rather than trusting a session
// that may have been left unlocked on a shared device.
export async function POST(request: Request) {
  const event = await getActiveEvent();
  const ip = clientIpFromHeaders(request.headers);
  if (await isLockedOut(ROUTE, ip, PIN_AUTH_RATE_LIMIT)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const { pin } = await request.json();
  if (!verifyPin(pin, event.organiserPin)) {
    await recordAuthFailure(ROUTE, ip, PIN_AUTH_RATE_LIMIT);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rows = (await getAllRegistrations(event.id)).map(flattenCustomFields);
  const customColumns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key.startsWith("custom_")))),
  ).sort();
  const csv = toCsv(rows, [...BASE_COLUMNS, ...customColumns]);
  const filename = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
