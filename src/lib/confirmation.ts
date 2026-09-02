import { buildConfirmationMessage } from "@/lib/confirmation-message";
import { sendEmailConfirmation } from "@/lib/email";
import { generateRegistrationQrCode } from "@/lib/qr";
import { getResendSmsTarget, updateSmsStatus } from "@/lib/registrations-store";
import { sendSmsConfirmation } from "@/lib/sms";

export type ConfirmationInput = {
  registrationId: string;
  eventName: string;
  eventDate: string;
  name: string;
  phone: string;
  email?: string;
  // A test registration should never consume real SMS float, whether the submission came from
  // a local e2e run or a manual Preview quality-checklist check (ported from busherian-hike
  // issue #97).
  isTestRow?: boolean;
};

export type ConfirmationResult = {
  smsSent: boolean;
  emailSent: boolean;
};

// Called by completeRegistration (src/app/actions.ts) once the payment proof is submitted.
export async function sendConfirmation(input: ConfirmationInput): Promise<ConfirmationResult> {
  if (input.isTestRow) {
    console.log(
      `[confirmation:skipped-test-row] registration ${input.registrationId} is a test row — not sending real SMS/email`,
    );
    return { smsSent: false, emailSent: false };
  }

  const message = buildConfirmationMessage(input.eventName, input.eventDate, input.name);
  const smsSent = await sendSmsConfirmation(input.phone, message);

  let emailSent = false;
  if (input.email) {
    const qrDataUrl = await generateRegistrationQrCode(input.registrationId);
    emailSent = await sendEmailConfirmation(input.email, input.name, qrDataUrl);
  }

  return { smsSent, emailSent };
}

export type ResendSmsResult =
  | { status: "sent" }
  | { status: "failed" }
  | { status: "skipped" }
  | { status: "not_found" };

// Shared by the manual Resend button (POST /api/payments/resend-sms) and a future retry
// mechanism (issue #11) — both just need "try the SMS again for this row and persist the
// outcome," not the QR/email machinery sendConfirmation's first attempt also runs (a resend is
// SMS-only, on request or on retry; there's no reason to regenerate the QR or re-send the email
// every time).
export async function resendSmsConfirmation(
  eventId: string,
  eventName: string,
  eventDate: string,
  registrationId: string,
): Promise<ResendSmsResult> {
  const target = await getResendSmsTarget(eventId, registrationId);
  if (!target) return { status: "not_found" };

  if (target.isTestRow) {
    await updateSmsStatus(registrationId, "skipped");
    console.log(
      `[confirmation:skipped-test-row] registration ${registrationId} is a test row — not sending real SMS`,
    );
    return { status: "skipped" };
  }

  const message = buildConfirmationMessage(eventName, eventDate, target.name);
  const sent = await sendSmsConfirmation(target.payerPhone, message);
  await updateSmsStatus(registrationId, sent ? "sent" : "failed");
  return { status: sent ? "sent" : "failed" };
}
