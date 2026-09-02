import { z } from "zod";
import { buildCustomFieldsSchema, type EventFieldDefinition } from "./event-fields";

export const KENYAN_PHONE_REGEX = /^(?:\+254|0)[17]\d{8}$/;

export const MEDIA_CONSENT_VALUES = ["yes", "no"] as const;

// Fields every event needs regardless of what it's for — logistics/legal baseline, not event
// content. Everything event-specific (age group, ticket type, school, shirt size, ...) is a
// custom field instead, per generalize.md's Decisions: future events are expected to be
// genuinely unique, so these don't get hardcoded per-event columns/constants the way
// busherian-hike's SCHOOL_OPTIONS/AGE_GROUP_OPTIONS/TICKET_TYPE_OPTIONS were.
export const BaseRegistrationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  guestCount: z.coerce
    .number()
    .int("Enter a whole number")
    .min(0, "Guest count can't be negative")
    .max(10, "Contact the organiser for more than 10 guests"),
  nextOfKinName: z.string().trim().min(1, "Next-of-kin name is required"),
  nextOfKinContact: z
    .string()
    .trim()
    .regex(KENYAN_PHONE_REGEX, "Enter a valid phone number, e.g. 0712345678"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).optional(),
  // Gates on the event's Terms and Conditions — the participant must tick it themselves, so a
  // missing/false value is a validation failure, not a default (ported from busherian-hike
  // issue #94).
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, "You must accept the Terms and Conditions to register"),
  mediaConsent: z.enum(MEDIA_CONSENT_VALUES, {
    message: "Select whether you consent to photo/media use",
  }),
  isTestRow: z.boolean().optional().default(false),
});

export type BaseRegistrationInput = z.infer<typeof BaseRegistrationSchema>;

// `...BaseRegistrationSchema.shape` rather than `.extend()`/`.merge()`, matching
// busherian-hike's complete-registration.ts precedent — avoids depending on which of those Zod
// v4 still exposes identically. `custom` is nested rather than flattened so an event's custom
// field key can never collide with (or silently shadow) a baseline field name.
export function buildRegistrationSchema(customFields: EventFieldDefinition[]) {
  return z.object({
    ...BaseRegistrationSchema.shape,
    custom: buildCustomFieldsSchema(customFields),
  });
}

export type RegistrationSchema = ReturnType<typeof buildRegistrationSchema>;
export type RegistrationInput = z.infer<RegistrationSchema>;
export type RegistrationFieldErrors = Record<string, string>;

export function parseRegistration(
  schema: RegistrationSchema,
  input: unknown,
):
  | { success: true; data: RegistrationInput }
  | { success: false; errors: RegistrationFieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: RegistrationFieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (path && !errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}
