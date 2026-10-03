import { describe, expect, it } from "vitest";
import { normalizeKeyword, parseKeywords, validateSearchFilters } from "@/lib/keywords";
import type { SearchFilterParams } from "@/lib/keywords";

const base: SearchFilterParams = {
  query: "",
  category: "all",
  city: "all",
  priceMin: "",
  priceMax: "",
  includeKeywords: [],
  excludeKeywords: [],
  hasImage: false,
};

describe("parseKeywords", () => {
  it("splits on spaces and Persian commas", () => {
    expect(parseKeywords("پژو ۲۰۶، سالم")).toEqual(["پژو", "۲۰۶", "سالم"]);
  });

  it("normalizes Arabic Yeh/Kaf to Persian", () => {
    expect(parseKeywords("علي كتاب")).toEqual(["علی", "کتاب"]);
  });

  it("drops empties and dedupes", () => {
    expect(parseKeywords("  نو   نو  ،، کارکرده ")).toEqual(["نو", "کارکرده"]);
  });

  it("caps at 20 terms", () => {
    const raw = Array.from({ length: 25 }, (_, i) => `کلمه${i}`).join(" ");
    expect(parseKeywords(raw)).toHaveLength(20);
  });

  it("returns empty array for blank input", () => {
    expect(parseKeywords("   ")).toEqual([]);
  });
});

describe("normalizeKeyword", () => {
  it("preserves inner spaces (one chip = one term)", () => {
    expect(normalizeKeyword("  پژو ۲۰۶ ")).toBe("پژو ۲۰۶");
  });

  it("returns empty for blank input", () => {
    expect(normalizeKeyword("   ")).toBe("");
  });
});

describe("validateSearchFilters", () => {
  it("accepts empty prices", () => {
    expect(validateSearchFilters(base)).toBeNull();
  });

  it("rejects min greater than max", () => {
    expect(validateSearchFilters({ ...base, priceMin: "200", priceMax: "100" })).toBe(
      "کف قیمت از سقف بیشتر است"
    );
  });

  it("rejects negative prices", () => {
    expect(validateSearchFilters({ ...base, priceMin: "-5" })).toBe("کف قیمت معتبر نیست");
  });
});
