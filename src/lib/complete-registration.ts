import { z } from "zod";
import { buildRegistrationSchema } from "./registration";
import { buildPaymentProofSchema } from "./payment-providers";
import type { EventFieldDefinition } from "./event-fields";

// Combines the registration fields with the active payment provider's proof fields into one
// schema — the single write only ever happens once both are valid together, ported from
// busherian-hike issue #106's rework (there's no longer a separate "registration" schema and
// "payment proof" schema validated at different times against different existing rows).
// `...registrationSchema.shape` rather than `.extend()`/`.merge()`, same reasoning as
// busherian-hike's own complete-registration.ts.
export function buildCompleteRegistrationSchema(
  customFields: EventFieldDefinition[],
  paymentProvider: string,
) {
  const registrationSchema = buildRegistrationSchema(customFields);
  return z.object({
    ...registrationSchema.shape,
    proof: buildPaymentProofSchema(paymentProvider),
  });
}

export type CompleteRegistrationSchema = ReturnType<typeof buildCompleteRegistrationSchema>;
export type CompleteRegistrationInput = z.infer<CompleteRegistrationSchema>;
export type CompleteRegistrationFieldErrors = Record<string, string>;

export function parseCompleteRegistration(
  schema: CompleteRegistrationSchema,
  input: unknown,
):
  | { success: true; data: CompleteRegistrationInput }
  | { success: false; errors: CompleteRegistrationFieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: CompleteRegistrationFieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}
