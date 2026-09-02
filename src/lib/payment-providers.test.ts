import { describe, expect, it } from "vitest";
import { buildPaymentProofSchema, MpesaManualProofSchema } from "./payment-providers";

describe("buildPaymentProofSchema", () => {
  it("returns the M-Pesa manual proof schema for mpesa_manual", () => {
    expect(buildPaymentProofSchema("mpesa_manual")).toBe(MpesaManualProofSchema);
  });

  it("throws for an unimplemented provider", () => {
    expect(() => buildPaymentProofSchema("intasend_link")).toThrow(
      /Unsupported payment provider "intasend_link"/,
    );
  });
});

describe("MpesaManualProofSchema", () => {
  it("accepts a valid phone and code", () => {
    const result = MpesaManualProofSchema.safeParse({
      payerPhone: "0712345678",
      mpesaCode: "QAB1CD2EFG",
    });
    expect(result.success).toBe(true);
  });

  it("strips non-alphanumeric characters from the M-Pesa code", () => {
    const result = MpesaManualProofSchema.safeParse({
      payerPhone: "0712345678",
      mpesaCode: "QAB-1CD 2EFG",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mpesaCode).toBe("QAB1CD2EFG");
    }
  });

  it("rejects an invalid phone number", () => {
    const result = MpesaManualProofSchema.safeParse({
      payerPhone: "12345",
      mpesaCode: "QAB1CD2EFG",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty M-Pesa code", () => {
    const result = MpesaManualProofSchema.safeParse({
      payerPhone: "0712345678",
      mpesaCode: "",
    });
    expect(result.success).toBe(false);
  });
});
