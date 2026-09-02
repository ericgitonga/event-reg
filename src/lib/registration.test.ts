import { describe, expect, it } from "vitest";
import { buildRegistrationSchema, parseRegistration } from "./registration";
import type { EventFieldDefinition } from "./event-fields";

const CUSTOM_FIELDS: EventFieldDefinition[] = [
  { key: "ticketType", label: "Ticket type", type: "select", required: true, options: ["full", "socials"] },
];

const VALID_INPUT = {
  name: "Jane Doe",
  guestCount: 1,
  nextOfKinName: "John Doe",
  nextOfKinContact: "0712345678",
  email: "jane@example.com",
  termsAccepted: true,
  mediaConsent: "yes",
  custom: { ticketType: "full" },
};

describe("buildRegistrationSchema / parseRegistration", () => {
  it("accepts valid input with its event's custom fields", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects a missing required custom field", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, { ...VALID_INPUT, custom: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["custom.ticketType"]).toBeDefined();
    }
  });

  it("rejects termsAccepted: false", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, { ...VALID_INPUT, termsAccepted: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.termsAccepted).toMatch(/Terms and Conditions/);
    }
  });

  it("rejects an invalid Kenyan phone number", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, { ...VALID_INPUT, nextOfKinContact: "12345" });
    expect(result.success).toBe(false);
  });

  it("allows an empty email (optional field)", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, { ...VALID_INPUT, email: "" });
    expect(result.success).toBe(true);
  });

  it("defaults isTestRow to false when omitted", () => {
    const schema = buildRegistrationSchema(CUSTOM_FIELDS);
    const result = parseRegistration(schema, VALID_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isTestRow).toBe(false);
    }
  });

  it("works for an event with no custom fields at all", () => {
    const schema = buildRegistrationSchema([]);
    const result = parseRegistration(schema, { ...VALID_INPUT, custom: {} });
    expect(result.success).toBe(true);
  });
});
