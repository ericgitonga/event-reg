import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { purgeContactFields } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

// Vercel Cron (see vercel.json) automatically sends `Authorization: Bearer $CRON_SECRET` on
// scheduled invocations — this rejects any other caller, including a guessed URL hit directly.
// Unlike busherian-hike's single-event version, the retention cutoff check isn't done here: it's
// per-event (event_date + retention_days), so purgeContactFields' own query scopes each row by
// its event, iterating every event this deployment has ever served in one call rather than just
// the currently active one (generalize.md §8).
export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const count = await purgeContactFields();
  return NextResponse.json({ purged: count });
}
