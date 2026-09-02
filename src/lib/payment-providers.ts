import { z } from "zod";
import { KENYAN_PHONE_REGEX } from "./registration";

// Only "mpesa_manual" is actually implemented so far — ported as-is from busherian-hike's
// direct-M-Pesa send-and-prove-it flow (a stopgap there too, per generalize.md's Decisions:
// "The current m-pesa send option is only due to the actual till details not being ready").
// Other rails (a Payment Link, a webhook-verified till) get added here once a real event
// actually needs one, not speculatively ahead of that — same reasoning as generalize.md's
// Phase 3 being deferred until concurrent multi-event support is actually needed.
export const PAYMENT_PROVIDERS = ["mpesa_manual"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

// Shape of `events.payment_config_json` for this provider — the recipient to display in the
// registration success message.
export const MpesaManualConfigSchema = z.object({
  recipientPhone: z.string().trim().min(1),
  recipientName: z.string().trim().min(1),
});
export type MpesaManualConfig = z.infer<typeof MpesaManualConfigSchema>;

// Shape of the participant-submitted proof for this provider.
export const MpesaManualProofSchema = z.object({
  payerPhone: z
    .string()
    .trim()
    .regex(KENYAN_PHONE_REGEX, "Enter a valid phone number, e.g. 0712345678"),
  mpesaCode: z
    .string()
    .transform((value) => value.replace(/[^A-Za-z0-9]/g, ""))
    .refine((value) => value.length > 0, { message: "Enter your M-Pesa transaction code" })
    .refine((value) => value.length <= 50, { message: "M-Pesa transaction code is too long" }),
});
export type MpesaManualProof = z.infer<typeof MpesaManualProofSchema>;

// Throws for any provider not yet implemented, rather than silently accepting arbitrary proof
// shapes — an event seeded with an unsupported `payment_provider` should fail loudly at the
// point registration is attempted, not produce a schema that accepts anything.
export function buildPaymentProofSchema(provider: string): z.ZodType {
  switch (provider) {
    case "mpesa_manual":
      return MpesaManualProofSchema;
    default:
      throw new Error(
        `Unsupported payment provider "${provider}" — only "mpesa_manual" is implemented so far.`,
      );
  }
}
