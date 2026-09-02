"use server";

import { headers } from "next/headers";
import { getActiveEvent } from "@/lib/events-store";
import { parseEventFields } from "@/lib/event-fields";
import { buildRegistrationSchema, parseRegistration, type RegistrationFieldErrors } from "@/lib/registration";
import {
  buildCompleteRegistrationSchema,
  parseCompleteRegistration,
  type CompleteRegistrationFieldErrors,
} from "@/lib/complete-registration";
import { getSlotsRemaining, insertCompleteRegistration } from "@/lib/registrations-store";
import {
  checkRateLimit,
  clientIpFromHeaders,
  COMPLETE_REGISTRATION_RATE_LIMIT,
  REGISTRATION_RATE_LIMIT,
} from "@/lib/rate-limit";

export type ValidateRegistrationResult =
  | { success: true }
  | { success: false; reason: "validation"; errors: RegistrationFieldErrors }
  | { success: false; reason: "full" }
  | { success: false; reason: "rate_limited" };

// The "Register" click — validates the main form and checks capacity, but writes nothing to the
// database (ported from busherian-hike issue #106). It only ever gates whether the payment step
// opens; completeRegistration below re-validates everything from scratch rather than trusting
// that this step already ran, so this is a client-experience gate, not a security boundary.
export async function validateRegistration(input: unknown): Promise<ValidateRegistrationResult> {
  const event = await getActiveEvent();
  const ip = clientIpFromHeaders(await headers());
  if (!(await checkRateLimit("register", ip, REGISTRATION_RATE_LIMIT))) {
    return { success: false, reason: "rate_limited" };
  }

  const schema = buildRegistrationSchema(parseEventFields(event.config));
  const result = parseRegistration(schema, input);
  if (!result.success) {
    return { success: false, reason: "validation", errors: result.errors };
  }

  if ((await getSlotsRemaining(event.id, event.capacityCap)) <= 0) {
    return { success: false, reason: "full" };
  }

  return { success: true };
}

export type CompleteRegistrationResult =
  | { success: true }
  | { success: false; reason: "validation"; errors: CompleteRegistrationFieldErrors }
  | { success: false; reason: "full" }
  | { success: false; reason: "rate_limited" };

// The payment-proof submit — the *only* place a registration row is ever written (ported from
// busherian-hike issue #106). Re-validates every field from scratch (both the main registration
// fields and the payment proof, via the combined schema) rather than trusting
// validateRegistration's earlier pass, then re-checks capacity (slots could have filled between
// the two steps), then performs the single insert.
//
// Confirmation (SMS/email) is deliberately not wired in here yet — see issue #6. A registration
// written by this action has no sms_status set until #6 adds that call.
export async function completeRegistration(input: unknown): Promise<CompleteRegistrationResult> {
  const event = await getActiveEvent();
  const ip = clientIpFromHeaders(await headers());
  if (!(await checkRateLimit("complete-registration", ip, COMPLETE_REGISTRATION_RATE_LIMIT))) {
    return { success: false, reason: "rate_limited" };
  }

  const schema = buildCompleteRegistrationSchema(parseEventFields(event.config), event.paymentProvider);
  const result = parseCompleteRegistration(schema, input);
  if (!result.success) {
    return { success: false, reason: "validation", errors: result.errors };
  }

  if ((await getSlotsRemaining(event.id, event.capacityCap)) <= 0) {
    return { success: false, reason: "full" };
  }

  await insertCompleteRegistration(event.id, result.data);

  return { success: true };
}
