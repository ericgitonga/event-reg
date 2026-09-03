import { describe, expect, it } from "vitest";
import { LandingConfigSchema, parseLandingConfig } from "./landing-config";

describe("LandingConfigSchema", () => {
  it("defaults every array field to empty and every optional field to undefined", () => {
    const result = LandingConfigSchema.parse({});
    expect(result).toEqual({
      highlights: [],
      pricingCardInclusions: [],
      sponsors: [],
    });
  });

  it("rejects a sponsor with a non-URL linkHref", () => {
    const result = LandingConfigSchema.safeParse({
      sponsors: [{ name: "Acme", linkHref: "not-a-url" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully populated config", () => {
    const result = LandingConfigSchema.safeParse({
      tagline: "Come one, come all",
      hostedBy: "Hosted by the organising committee",
      highlights: ["🎉 Live music", "🍔 Food included"],
      pricingCardInclusions: ["Entry", "One meal"],
      partnershipSentence: "In partnership with Acme Corp",
      sponsors: [
        { name: "Acme Corp", logoFilename: "acme-logo.png", linkHref: "https://acme.example" },
        { name: "No Logo Yet" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("parseLandingConfig", () => {
  it("treats a missing `landing` key as an all-defaults config, not an error", () => {
    expect(() => parseLandingConfig({})).not.toThrow();
    expect(parseLandingConfig({})).toEqual({
      highlights: [],
      pricingCardInclusions: [],
      sponsors: [],
    });
  });

  it("reads config.landing, not top-level keys", () => {
    const parsed = parseLandingConfig({
      landing: { tagline: "Nested tagline" },
      tagline: "Ignored top-level tagline",
    });
    expect(parsed.tagline).toBe("Nested tagline");
  });
});
