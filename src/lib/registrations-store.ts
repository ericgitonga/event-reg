import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { computeSlotsRemaining } from "@/lib/capacity";
import type { CompleteRegistrationInput } from "@/lib/complete-registration";
import type { MpesaManualProof } from "@/lib/payment-providers";

export type CompletedRegistration = {
  id: string;
  name: string;
  email: string | null;
  isTestRow: boolean;
};

// The only place a registration row is ever written, matching busherian-hike issue #106's
// rework — the write happens once, together with the payment proof, not as a separate
// insert-then-update. `proof` is typed as the M-Pesa manual shape since that's the only payment
// provider implemented so far (src/lib/payment-providers.ts); this narrows further (or becomes
// a per-provider branch) once a second provider is actually added.
export async function insertCompleteRegistration(
  eventId: string,
  input: CompleteRegistrationInput,
): Promise<CompletedRegistration> {
  const id = randomUUID();
  const proof = input.proof as MpesaManualProof;
  await db.execute({
    sql: `INSERT INTO registrations (
      id, event_id, name, guest_count, next_of_kin_name, next_of_kin_contact, email,
      terms_accepted, media_consent, custom_fields_json, is_test_row, mpesa_code, payer_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      eventId,
      input.name,
      input.guestCount,
      input.nextOfKinName,
      input.nextOfKinContact,
      input.email || null,
      input.termsAccepted ? 1 : 0,
      input.mediaConsent,
      JSON.stringify(input.custom),
      input.isTestRow ? 1 : 0,
      proof.mpesaCode,
      proof.payerPhone,
    ],
  });
  return { id, name: input.name, email: input.email || null, isTestRow: !!input.isTestRow };
}

// Headcount, not row count — a paid registration's guests count against capacity the same as
// the registrant themselves (ported from busherian-hike issue #82). Scoped by event_id since
// this database can hold more than one event's rows (generalize.md §2/§3).
export async function getPaidCount(eventId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COALESCE(SUM(1 + guest_count), 0) as n FROM registrations WHERE event_id = ? AND paid = 1",
    args: [eventId],
  });
  return Number(result.rows[0].n);
}

export async function getSlotsRemaining(eventId: string, capacityCap: number): Promise<number> {
  return computeSlotsRemaining(capacityCap, await getPaidCount(eventId));
}
