import { describe, expect, it } from "vitest";
import { normalizeCode, normalizeMobile, randomCode } from "@/lib/otp/mobile";

describe("normalizeMobile", () => {
  it("accepts plain Iranian mobiles", () => {
    expect(normalizeMobile("09123456789")).toBe("09123456789");
  });
  it("accepts Persian digits, spaces and dashes", () => {
    expect(normalizeMobile("۰۹۱۲ ۳۴۵-۶۷۸۹")).toBe("09123456789");
  });
  it("rejects non-mobile input", () => {
    expect(normalizeMobile("12345")).toBeNull();
    expect(normalizeMobile("+989123456789")).toBeNull();
    expect(normalizeMobile("00989123456789")).toBeNull();
    expect(normalizeMobile("")).toBeNull();
  });
});

describe("normalizeCode", () => {
  it("accepts 5 digits incl. Persian", () => {
    expect(normalizeCode("12345")).toBe("12345");
    expect(normalizeCode("۱۲۳۴۵")).toBe("12345");
  });
  it("rejects other lengths", () => {
    expect(normalizeCode("1234")).toBeNull();
    expect(normalizeCode("123456")).toBeNull();
    expect(normalizeCode("abcde")).toBeNull();
  });
});

describe("randomCode", () => {
  it("produces 5-digit numeric codes", () => {
    for (let i = 0; i < 50; i++) {
      expect(/^\d{5}$/.test(randomCode())).toBe(true);
    }
  });
});
