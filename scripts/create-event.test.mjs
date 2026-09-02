import { describe, expect, it } from "vitest";
import { validateEventInput } from "./create-event.mjs";

const VALID_INPUT = {
  id: "ngong-hike-2026",
  slug: "ngong-hike-2026",
  name: "AHS/AGHS Alumni Ngong Hills Hike",
  eventDate: "2026-09-19",
  venue: "Ngong Hills",
  capacityCap: 100,
  currency: "KES",
  perHeadFee: 1500,
  paymentProvider: "mpesa_manual",
  paymentConfig: { recipientPhone: "0723893192" },
  retentionDays: 30,
  organiserPin: "1234",
  config: { tagline: "Watu!!" },
};

describe("validateEventInput", () => {
  it("accepts a fully-populated valid config", () => {
    expect(() => validateEventInput(VALID_INPUT)).not.toThrow();
  });

  it("accepts a config with only the required fields", () => {
    const minimal = {
      id: "a",
      slug: "a",
      name: "A",
      eventDate: "2026-01-01",
      paymentProvider: "mpesa_manual",
      organiserPin: "1234",
      capacityCap: 10,
      perHeadFee: 100,
      retentionDays: 30,
    };
    expect(() => validateEventInput(minimal)).not.toThrow();
  });

  it("reports every missing required field at once", () => {
    expect(() => validateEventInput({})).toThrow(
      /"id".*"slug".*"name".*"eventDate".*"paymentProvider".*"organiserPin".*"capacityCap".*"perHeadFee".*"retentionDays"/s,
    );
  });

  it("rejects a non-numeric capacityCap", () => {
    expect(() => validateEventInput({ ...VALID_INPUT, capacityCap: "100" })).toThrow(
      /"capacityCap" must be a number/,
    );
  });

  it("rejects a non-object config", () => {
    expect(() => validateEventInput({ ...VALID_INPUT, config: "not an object" })).toThrow(
      /"config" must be an object/,
    );
  });
});
