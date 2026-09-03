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
// are what the retry-failed-sms cron (issue #11) and the payments dashboard's manual Resend
// button (issue #8) would act on. A test row is written 'skipped' rather than left NULL, so
// it's visibly distinct from "never attempted yet."
export async function updateSmsStatus(registrationId: string, status: SmsStatus): Promise<void> {
  await db.execute({
    sql: "UPDATE registrations SET sms_status = ? WHERE id = ?",
    args: [status, registrationId],
  });
}

export type PaymentListRow = {
  id: string;
  name: string;
  guestCount: number;
  customFields: Record<string, unknown>;
  paid: boolean;
  mpesaCode: string | null;
  payerPhone: string | null;
  smsStatus: SmsStatus | null;
};

// For the PIN-gated "mark paid" list — deliberately narrower than getAllRegistrations: no
// next-of-kin name/contact or email, so this can't be used as a backdoor around the full
// export's stricter PIN re-check while still giving whoever's collecting payment enough (name,
// custom fields, guest count, the payment proof already on file) to find the right row and
// cross-check it against what they actually received.
export async function getRegistrationsForPayments(eventId: string): Promise<PaymentListRow[]> {
  const result = await db.execute({
    sql: `SELECT id, name, guest_count, custom_fields_json, paid, mpesa_code, payer_phone, sms_status
          FROM registrations WHERE event_id = ? ORDER BY name`,
    args: [eventId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    guestCount: Number(row.guest_count),
    customFields: JSON.parse(String(row.custom_fields_json)),
    paid: Number(row.paid) === 1,
    mpesaCode: row.mpesa_code ? String(row.mpesa_code) : null,
    payerPhone: row.payer_phone ? String(row.payer_phone) : null,
    smsStatus: row.sms_status ? (String(row.sms_status) as SmsStatus) : null,
  }));
}

// Idempotent, same reasoning as markCheckedIn: guards on paid = 0 so marking an already-paid row
// again is a silent no-op rather than clobbering the original paid_at. Scoped to event_id as
// defense in depth, same as markCheckedIn.
export async function markPaid(eventId: string, registrationId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE registrations
          SET paid = 1, paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? AND event_id = ? AND paid = 0`,
    args: [registrationId, eventId],
  });
  return result.rowsAffected > 0;
}

// Full rows, including next-of-kin numbers — gated behind a freshly re-verified PIN at the route
// level (see src/app/api/export/registrations/route.ts), never called from anywhere else.
export async function getAllRegistrations(eventId: string): Promise<Record<string, unknown>[]> {
  const result = await db.execute({
    sql: "SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at",
    args: [eventId],
  });
  return result.rows.map((row) => ({ ...row }));
}

// Irreversible, unlike every other mutation in this file — used for a mistaken/duplicate
// registration removed at the organiser's request. No capacity bookkeeping needed: getPaidCount()
// sums live from `paid = 1` rows on every read, so deleting a paid row frees its slot(s) the
// instant it's gone, the same way marking one paid consumes them.
export async function deleteRegistration(eventId: string, registrationId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM registrations WHERE id = ? AND event_id = ?",
    args: [registrationId, eventId],
  });
  return result.rowsAffected > 0;
}

export type ResendSmsTarget = { name: string; payerPhone: string; isTestRow: boolean };

// Only a row that's actually reached the payment-proof step (payer_phone IS NOT NULL) has
// anything to resend — one that hasn't gets NULL back, same "not ready yet" signal whether the
// caller is the manual Resend button or the retry-failed-sms cron (issue #11).
export async function getResendSmsTarget(
  eventId: string,
  registrationId: string,
): Promise<ResendSmsTarget | null> {
  const result = await db.execute({
    sql: `SELECT name, payer_phone, is_test_row FROM registrations
          WHERE id = ? AND event_id = ? AND payer_phone IS NOT NULL`,
    args: [registrationId, eventId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    name: String(row.name),
    payerPhone: String(row.payer_phone),
    isTestRow: Number(row.is_test_row) === 1,
  };
}

// Clears next-of-kin/email fields once an event's own retention window has passed (issue #11) —
// event_date + retention_days, computed per row's event via the join below, not a single global
// cutoff, since each event sets its own retentionDays (generalize.md §8's Decisions). Rows
// belonging to an event whose window hasn't passed yet are left untouched, so this can safely
// run against every event this deployment has ever served in one call, not just the active one.
// payer_phone/mpesa_code are deliberately untouched — payment-proof data, not the contact-info
// fields this purge exists to clear.
export async function purgeContactFields(): Promise<number> {
  const result = await db.execute(
    `UPDATE registrations
     SET next_of_kin_name = '', next_of_kin_contact = '', email = NULL
     WHERE (next_of_kin_name != '' OR next_of_kin_contact != '' OR email IS NOT NULL)
       AND event_id IN (
         SELECT id FROM events
         WHERE date(event_date, '+' || retention_days || ' days') <= date('now')
       )`,
  );
  return result.rowsAffected;
}

export type FailedSmsRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  registrationId: string;
  name: string;
  payerPhone: string;
};

// Every row whose last SMS attempt failed, across every event this deployment has ever served —
// not scoped to the active event, per generalize.md §8, since a retry cron should catch up a
// stale failure regardless of which event is currently active. Joined to `events` (rather than
// just returning event_id) so the caller has everything resendSmsConfirmation/
// buildConfirmationMessage need to rebuild that event's confirmation message without a second
// query per row.
export async function getFailedSmsRegistrations(): Promise<FailedSmsRow[]> {
  const result = await db.execute(
    `SELECT registrations.id AS registration_id, registrations.name AS name,
            registrations.payer_phone AS payer_phone,
            events.id AS event_id, events.name AS event_name, events.event_date AS event_date
     FROM registrations
     JOIN events ON events.id = registrations.event_id
     WHERE registrations.sms_status = 'failed'`,
  );
  return result.rows.map((row) => ({
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    eventDate: String(row.event_date),
    registrationId: String(row.registration_id),
    name: String(row.name),
    payerPhone: String(row.payer_phone),
  }));
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
