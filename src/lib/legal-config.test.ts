import { describe, expect, it } from "vitest";
import { LegalConfigSchema, parseLegalConfig } from "./legal-config";

describe("LegalConfigSchema", () => {
  it("rejects an empty config — unlike LandingConfigSchema, every field is required", () => {
    const result = LegalConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a config missing just one required field", () => {
    const result = LegalConfigSchema.safeParse({
      entityName: "Acme Events",
      organiserName: "Acme Organising Committee",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully populated config", () => {
    const result = LegalConfigSchema.safeParse({
      entityName: "Acme Events",
      organiserName: "Acme Organising Committee",
      organiserEmail: "organiser@acme.example",
    });
    expect(result.success).toBe(true);
  });
});

describe("parseLegalConfig", () => {
  it("throws when the config has no `legal` key at all", () => {
    expect(() => parseLegalConfig({})).toThrow();
  });

  it("reads config.legal, not top-level keys", () => {
    const parsed = parseLegalConfig({
      legal: {
        entityName: "Nested Entity",
        organiserName: "Nested Organiser",
        organiserEmail: "nested@example.com",
      },
      entityName: "Ignored top-level entity",
    });
    expect(parsed.entityName).toBe("Nested Entity");
  });
});
