import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "./client-ip";

describe("clientIpFromHeaders", () => {
  it("takes the first address from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFromHeaders(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "9.8.7.6" });
    expect(clientIpFromHeaders(headers)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
