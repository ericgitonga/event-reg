import { z } from "zod";

// Describes *how* an event's custom registration field is shaped (type, label, required-ness),
// not a fixed enum of which field names an event is allowed to have — per generalize.md's
// Decisions (2026-09-02): future events are expected to be genuinely unique, not minor
// variations on the first one, so the schema validates field structure rather than a hardcoded
// list of known field keys (age group, school, ticket type, etc. all become instances of this
// generic shape instead of their own dedicated columns/constants).
export const FIELD_TYPES = ["text", "number", "select", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const EventFieldDefinitionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must be a valid identifier"),
    label: z.string().trim().min(1),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    // Only meaningful (and required) for type "select" — validated below rather than as a
    // Zod discriminated union, since a plain JSON config file is easier to hand-author without
    // fighting a discriminated union's exact-shape requirements.
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(
    (field) => field.type !== "select" || (field.options && field.options.length > 0),
    { message: "select fields must declare at least one option", path: ["options"] },
  );

export type EventFieldDefinition = z.infer<typeof EventFieldDefinitionSchema>;

export const EventFieldsSchema = z.array(EventFieldDefinitionSchema);

// An event with no custom fields at all simply omits `fields` from its config — treated as an
// empty list rather than an error, so a minimal event config doesn't need a redundant `[]`.
export function parseEventFields(config: Record<string, unknown>): EventFieldDefinition[] {
  return EventFieldsSchema.parse(config.fields ?? []);
}

// Builds a Zod schema for one event's custom-field set at request time — the whole point of
// making these config-driven rather than hardcoded per-event TypeScript constants. Field order
// isn't meaningful to the resulting schema (only to how a form renders them), so this can be
// called with the fields in whatever order config_json stored them.
export function buildCustomFieldsSchema(fields: EventFieldDefinition[]): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    let fieldSchema: z.ZodType;
    switch (field.type) {
      case "text":
        fieldSchema = z.string().trim().min(field.required ? 1 : 0);
        break;
      case "number":
        fieldSchema = z.coerce.number();
        break;
      case "select":
        // `field.options` is guaranteed non-empty by EventFieldDefinitionSchema's refine above.
        fieldSchema = z.enum(field.options as [string, ...string[]]);
        break;
      case "checkbox":
        fieldSchema = z.boolean();
        break;
    }
    shape[field.key] = field.required ? fieldSchema : fieldSchema.optional();
  }
  return z.object(shape);
}
