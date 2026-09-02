// PLACEHOLDER, ported from busherian-hike — no real email provider wired up yet (a Resend
// integration, matching umoja-voices' src/lib/email.ts, is the obvious low-friction choice when
// this is actually asked for). No-ops until RESEND_API_KEY is set.
export async function sendEmailConfirmation(
  to: string,
  name: string,
  qrDataUrl: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email:skipped] no RESEND_API_KEY configured — would have sent to ${to} (${name}, QR attached: ${qrDataUrl.length} bytes)`,
    );
    return false;
  }
  console.log(`[email:skipped] RESEND_API_KEY is set but sending isn't implemented yet — would have sent to ${to}`);
  return false;
}
