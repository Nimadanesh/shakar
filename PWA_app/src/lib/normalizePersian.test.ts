import { describe, expect, it } from "vitest";

import { normalizePersian } from "./normalizePersian";

describe("normalizePersian", () => {
  it("returns empty string for empty or blank input", () => {
    expect(normalizePersian("")).toBe("");
    expect(normalizePersian("   ")).toBe("");
  });

  it("maps Arabic Kaf and Yeh to their Persian forms", () => {
    expect(normalizePersian("كتاب يخ")).toBe("کتاب یخ");
  });

  it("strips Arabic diacritics", () => {
    expect(normalizePersian("مَدرسه")).toBe("مدرسه");
  });

  it("strips tatweel (kashida)", () => {
    expect(normalizePersian("کتـــاب")).toBe("کتاب");
  });

  it("maps Teh Marbuta to Heh", () => {
    expect(normalizePersian("مدرسة")).toBe("مدرسه");
  });

  it("lowercases Latin text and collapses whitespace", () => {
    expect(normalizePersian("  BMW   X5  ")).toBe("bmw x5");
  });

  it("preserves ZWNJ half-spaces (documented MVP decision)", () => {
    expect(normalizePersian("می‌شود")).toBe("می‌شود");
  });

  it("preserves Persian digits", () => {
    expect(normalizePersian("مدل ۲۰۲۰")).toBe("مدل ۲۰۲۰");
  });

  it("handles a realistic ad snippet end to end", () => {
    expect(normalizePersian("ماشين مدل ٢٠٢٠، بدون رنگ و ضربه!")).toBe(
      "ماشین مدل ۲۰۲۰، بدون رنگ و ضربه!",
    );
  });
});
