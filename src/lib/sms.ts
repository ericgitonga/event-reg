import { randomUUID } from "node:crypto";

// SasaSignal (https://sasasignal.com/api) transactional SMS, ported from busherian-hike.
// SASASIGNAL_API_TOKEN/SASASIGNAL_SENDER_ID stay deployment-level secrets, not per-event —
// provider credentials are an infrastructure concern, not an event concern (generalize.md §6).
const SASASIGNAL_SEND_URL = "https://sasasignal.com/api/v1/sms/transactional/send";

export const SASASIGNAL_SENDER_ID = "SMSBiashara";

// KENYAN_PHONE_REGEX (registration.ts) accepts either "0712345678" or "+254712345678". SasaSignal's
// docs are only explicit about the "+254xxxxxxxxx" form, so this normalizes to that form rather
// than guessing the bare-0 form is also accepted.
export function toSasaSignalPhone(phone: string): string {
  return phone.startsWith("0") ? `+254${phone.slice(1)}` : phone;
}

export async function sendSmsConfirmation(phone: string, message: string): Promise<boolean> {
  const token = process.env.SASASIGNAL_API_TOKEN;
  if (!token) {
    console.log(
      `[sms:skipped] no SASASIGNAL_API_TOKEN configured — would have sent to ${phone}: ${message}`,
    );
    return false;
  }

  const body = new FormData();
  body.set("sender_id", SASASIGNAL_SENDER_ID);
  body.set("message", message);
  body.set("recipient", toSasaSignalPhone(phone));

  try {
    const response = await fetch(SASASIGNAL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Required by SasaSignal's API — a fresh key per send so a retried request can't
        // double-send the same SMS.
        "Idempotency-Key": randomUUID(),
      },
      body,
    });

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      console.log(
        `[sms:failed] SasaSignal responded ${response.status} sending to ${phone}: ${text}`,
      );
      return false;
    }

    console.log(`[sms:accepted] SasaSignal accepted a send to ${phone}: ${text}`);
    return true;
  } catch (err) {
    console.log(
      `[sms:error] SasaSignal request failed sending to ${phone}: ${(err as Error).message}`,
    );
    return false;
  }
}
