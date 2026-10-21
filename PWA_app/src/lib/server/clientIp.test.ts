import { describe, expect, it } from "vitest";
import { getClientIp } from "./clientIp";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/", { headers });
}

describe("getClientIp (H1)", () => {
  it("trusts the LAST X-Forwarded-For entry (edge-appended), not the first", () => {
    // Attacker sends X-Forwarded-For: 1.2.3.4; the edge appends the real IP.
    const req = reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("handles a single entry", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("falls back to x-real-ip, then null", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIp(reqWith({}))).toBeNull();
  });

  it("ignores empty entries", () => {
    const req = reqWith({ "x-forwarded-for": "1.2.3.4, , 5.6.7.8 " });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });
});
