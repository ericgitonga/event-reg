import { describe, expect, it } from "vitest";
import { generateRegistrationQrCode } from "./qr";

describe("generateRegistrationQrCode", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateRegistrationQrCode("some-registration-id");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
