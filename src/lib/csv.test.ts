import { describe, expect, it } from "vitest";
import { flattenCustomFields, toCsv } from "./csv";

describe("toCsv", () => {
  it("renders a header row followed by each row's values in column order", () => {
    const csv = toCsv([{ id: "1", name: "Wanjiru" }, { id: "2", name: "Otieno" }], ["id", "name"]);
    expect(csv).toBe("id,name\r\n1,Wanjiru\r\n2,Otieno");
  });

  it("quotes and escapes a value containing a comma", () => {
    const csv = toCsv([{ name: "Kamau, Njoroge" }], ["name"]);
    expect(csv).toBe('name\r\n"Kamau, Njoroge"');
  });

  it("quotes and doubles internal quotes", () => {
    const csv = toCsv([{ name: 'Wa "Bester" Njeri' }], ["name"]);
    expect(csv).toBe('name\r\n"Wa ""Bester"" Njeri"');
  });

  it("renders null/undefined as an empty field", () => {
    const csv = toCsv([{ email: null }], ["email"]);
    expect(csv).toBe("email\r\n");
  });

  describe("formula injection", () => {
    it.each([
      ["+1+1", "'+1+1"],
      ["-2+3", "'-2+3"],
      ["\tmalicious", "'\tmalicious"],
    ])("prefixes a leading trigger character with a single quote: %j", (value, expected) => {
      const csv = toCsv([{ name: value }], ["name"]);
      expect(csv).toBe(`name\r\n${expected}`);
    });

    it("neutralizes a leading = even when the rest of the value also needs quoting", () => {
      const csv = toCsv([{ name: '=HYPERLINK("https://evil.example","click")' }], ["name"]);
      expect(csv).toBe('name\r\n"\'=HYPERLINK(""https://evil.example"",""click"")"');
    });

    it("neutralizes a leading @ even when the rest of the value also needs quoting", () => {
      const csv = toCsv([{ name: "@SUM(1,1)" }], ["name"]);
      expect(csv).toBe('name\r\n"\'@SUM(1,1)"');
    });

    it("neutralizes a leading CR — which also triggers CSV quoting on its own", () => {
      const csv = toCsv([{ name: "\rmalicious" }], ["name"]);
      expect(csv).toBe('name\r\n"\'\rmalicious"');
    });

    it("does not prefix a value that merely contains, but doesn't start with, a trigger character", () => {
      const csv = toCsv([{ name: "Kamau=Njoroge" }], ["name"]);
      expect(csv).toBe("name\r\nKamau=Njoroge");
    });

    it("leaves an ordinary name untouched", () => {
      const csv = toCsv([{ name: "Wanjiru Kamau" }], ["name"]);
      expect(csv).toBe("name\r\nWanjiru Kamau");
    });
  });
});

describe("flattenCustomFields", () => {
  it("expands custom_fields_json into one custom_<key> column per key", () => {
    const flat = flattenCustomFields({
      id: "1",
      name: "Jane",
      custom_fields_json: JSON.stringify({ ticketType: "full", ageGroup: "18+" }),
    });
    expect(flat).toEqual({
      id: "1",
      name: "Jane",
      custom_ticketType: "full",
      custom_ageGroup: "18+",
    });
  });

  it("returns the row unchanged (minus the raw JSON column) when there are no custom fields", () => {
    const flat = flattenCustomFields({ id: "1", custom_fields_json: "{}" });
    expect(flat).toEqual({ id: "1" });
  });

  it("handles a missing custom_fields_json gracefully", () => {
    const flat = flattenCustomFields({ id: "1" });
    expect(flat).toEqual({ id: "1" });
  });
});
