import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { resendSmsConfirmation } from "@/lib/confirmation";
import { getFailedSmsRegistrations } from "@/lib/registrations-store";

export const dynamic = "force-dynamic";

// Vercel Cron (see vercel.json), same auth pattern as purge-contact-fields. Retries every row
// whose last SMS attempt failed, across every event this deployment has ever served — not just
// the active one — since getFailedSmsRegistrations() is a cross-event join (generalize.md §8).
// Runs once daily: the `egm2` Vercel team is on the Hobby plan, which caps Cron Jobs at one
// invocation/day; the /payments Resend button remains the path for anything more time-sensitive
// than "by tomorrow morning."
export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const failed = await getFailedSmsRegistrations();
  let succeeded = 0;
  let stillFailed = 0;

  for (const row of failed) {
    const result = await resendSmsConfirmation(row.eventId, row.eventName, row.eventDate, row.registrationId);
    if (result.status === "sent") {
      succeeded += 1;
    } else {
      stillFailed += 1;
    }
  }

  return NextResponse.json({ retried: failed.length, succeeded, stillFailed });
}
