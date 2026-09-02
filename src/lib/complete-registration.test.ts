import { describe, expect, it } from "vitest";
import { buildCompleteRegistrationSchema, parseCompleteRegistration } from "./complete-registration";
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
  proof: { payerPhone: "0798765432", mpesaCode: "QAB1CD2EFG" },
};

describe("buildCompleteRegistrationSchema / parseCompleteRegistration", () => {
  it("accepts valid registration + mpesa_manual proof together", () => {
    const schema = buildCompleteRegistrationSchema(CUSTOM_FIELDS, "mpesa_manual");
    const result = parseCompleteRegistration(schema, VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid proof even when the registration fields are valid", () => {
    const schema = buildCompleteRegistrationSchema(CUSTOM_FIELDS, "mpesa_manual");
    const result = parseCompleteRegistration(schema, { ...VALID_INPUT, proof: { payerPhone: "bad", mpesaCode: "x" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["proof.payerPhone"]).toBeDefined();
    }
  });

  it("rejects an invalid registration field even when the proof is valid", () => {
    const schema = buildCompleteRegistrationSchema(CUSTOM_FIELDS, "mpesa_manual");
    const result = parseCompleteRegistration(schema, { ...VALID_INPUT, termsAccepted: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.termsAccepted).toBeDefined();
    }
  });

  it("throws when building against an unsupported payment provider", () => {
    expect(() => buildCompleteRegistrationSchema(CUSTOM_FIELDS, "intasend_link")).toThrow(
      /Unsupported payment provider/,
    );
  });
});
