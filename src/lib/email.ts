// PLACEHOLDER, ported from busherian-hike — no real email provider wired up yet (a Resend
// integration, matching umoja-voices' src/lib/email.ts, is the obvious low-friction choice when
// this is actually asked for). No-ops until RESEND_API_KEY is set.
//
// Never log `to`/`name` on either path below — this is the branch that actually runs in
// production today (RESEND_API_KEY is unset), so every completeRegistration call was writing
// the registrant's email/name to plaintext logs on every registration (issue #25, a High
// finding). Only the outcome gets logged, matching the "never PII" discipline already followed
// by checkin/mark, payments/mark, and payments/delete.
export async function sendEmailConfirmation(
  to: string,
  name: string,
  qrDataUrl: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[email:skipped] no RESEND_API_KEY configured");
    return false;
  }
  console.log("[email:skipped] RESEND_API_KEY is set but sending isn't implemented yet");
  return false;
}
