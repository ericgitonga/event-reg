import { buildConfirmationMessage } from "@/lib/confirmation-message";
import { sendEmailConfirmation } from "@/lib/email";
import { generateRegistrationQrCode } from "@/lib/qr";
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
