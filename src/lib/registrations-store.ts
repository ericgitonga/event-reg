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

export type Attendee = { id: string; name: string; checkedIn: boolean };

export async function getPaidAttendees(eventId: string): Promise<Attendee[]> {
  const result = await db.execute({
    sql: "SELECT id, name, checked_in FROM registrations WHERE event_id = ? AND paid = 1",
    args: [eventId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    checkedIn: Number(row.checked_in) === 1,
  }));
}

// Idempotent: only touches rows not already checked in, so a duplicate sync (offline retry,
// double scan) never overwrites the original checked_in_at timestamp. Scoped to event_id as
// defense in depth — an organiser session is already bound to one event (src/lib/auth.ts), but
// this stops a scanned id from ever mutating another event's row even if that ever changed.
// Returns whether a row was actually matched — a garbage or already-checked-in id is a silent
// no-op otherwise, with no way for the caller to tell that apart from a real check-in.
export async function markCheckedIn(eventId: string, registrationId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE registrations
          SET checked_in = 1, checked_in_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? AND event_id = ? AND checked_in = 0`,
    args: [registrationId, eventId],
  });
  return result.rowsAffected > 0;
}

export type SmsStatus = "sent" | "failed" | "skipped";

// Written once, right after sendConfirmation's one real attempt at insert time — 'failed' rows
// are what a future retry mechanism (issue #11) and the payments dashboard's manual Resend
// button (issue #8) would act on. A test row is written 'skipped' rather than left NULL, so
// it's visibly distinct from "never attempted yet."
export async function updateSmsStatus(registrationId: string, status: SmsStatus): Promise<void> {
  await db.execute({
    sql: "UPDATE registrations SET sms_status = ? WHERE id = ?",
    args: [status, registrationId],
  });
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
