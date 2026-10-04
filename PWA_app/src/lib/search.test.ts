import { describe, expect, it } from "vitest";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import {
  excerptSegments,
  explainWhy,
  includesTerm,
  queryContentTerms,
  runSearch,
  sortResults,
} from "@/lib/search";
import { EMPTY_SEARCH_CONTEXT } from "@/types/search";

const pianoContext = {
  ...EMPTY_SEARCH_CONTEXT,
  query: "پیانو یاماها",
  includeKeywords: ["یاماها"],
  excludeKeywords: ["دیجیتال"],
  city: "tehran",
  priceMax: 200000000,
};

describe("runSearch", () => {
  it("filters strictly and suppresses with factual reasons", () => {
    const { results, suppressed } = runSearch(pianoContext, SEARCH_FIXTURES);
    expect(results.map((r) => r.adId)).toEqual(["fx-u3-tehran"]);
    expect(suppressed).toEqual([
      { adId: "fx-digital-tehran", reason: "حذف‌شده به دلیل: دیجیتال" },
    ]);
    expect(results[0].strongMatch).toBe(true);
  });

  it("marks absent preferences as unknown, never filters", () => {
    const ctx = { ...EMPTY_SEARCH_CONTEXT, includeKeywords: ["پیانو"] };
    const { results } = runSearch(ctx, SEARCH_FIXTURES, ["U3"]);
    const u1 = results.find((r) => r.adId === "fx-u1-isfahan");
    const u3 = results.find((r) => r.adId === "fx-u3-tehran");
    expect(u1?.evidence).toContainEqual({ term: "u3", status: "unknown" });
    expect(u1?.strongMatch).toBe(false);
    expect(u3?.strongMatch).toBe(true);
  });

  it("keeps price-unknown ads instead of dropping them", () => {
    const ctx = {
      ...EMPTY_SEARCH_CONTEXT,
      includeKeywords: ["آکوستیک"],
      priceMax: 50000000,
    };
    const { results } = runSearch(ctx, SEARCH_FIXTURES);
    expect(results.map((r) => r.adId)).toContain("fx-handmade-tehran");
  });

  it("returns empty results for impossible constraints", () => {
    const ctx = { ...EMPTY_SEARCH_CONTEXT, includeKeywords: ["سازدهنی"] };
    expect(runSearch(ctx, SEARCH_FIXTURES).results).toEqual([]);
  });

  it("matches bare queries against listing text", () => {
    const ctx = { ...EMPTY_SEARCH_CONTEXT, query: "سازدهنی" };
    expect(runSearch(ctx, SEARCH_FIXTURES).results).toEqual([]);
    const piano = runSearch(
      { ...EMPTY_SEARCH_CONTEXT, query: "پیانو یاماها" },
      SEARCH_FIXTURES
    );
    expect(piano.results.length).toBeGreaterThan(0);
  });

  it("throws on malformed ads so the error state is real", () => {
    expect(() =>
      runSearch(EMPTY_SEARCH_CONTEXT, [{ id: "", title: "" } as never])
    ).toThrow();
  });
});

describe("queryContentTerms", () => {
  it("drops stopwords but keeps meaningful terms", () => {
    expect(queryContentTerms("پیانو یاماها میخوام تهران باشه", [])).toEqual([
      "پیانو",
      "یاماها",
      "تهران",
    ]);
  });

  it("drops excluded terms and vague queries yield content or nothing honest", () => {
    expect(queryContentTerms("سازدهنی", [])).toEqual(["سازدهنی"]);
    expect(queryContentTerms("خوب", [])).toEqual([]);
  });
});

describe("excerptSegments", () => {
  it("marks include-term hits inside a faithful slice", () => {
    const segments = excerptSegments("پیانو آکوستیک یاماها مدل U3 ساخت ژاپن", ["یاماها"]);
    expect(segments.some((s) => s.hit && s.text.includes("یاماها"))).toBe(true);
    expect(segments.map((s) => s.text).join("")).toContain("پیانو");
  });

  it("falls back to a plain slice without terms", () => {
    expect(excerptSegments("متن ساده", [])).toEqual([{ text: "متن ساده", hit: false }]);
  });

  it("matches quoted terms only on word boundaries", () => {
    expect(includesTerm("مدل u34 جدید", '"u3"')).toBe(false);
    expect(includesTerm("مدل u3 جدید", '"u3"')).toBe(true);
    expect(includesTerm("مدل u34 جدید", "u3")).toBe(true);
  });
});

describe("explainWhy", () => {
  const ad = SEARCH_FIXTURES.find((a) => a.id === "fx-u3-tehran")!;

  it("explains from detected terms and verified absences", () => {
    const explanation = explainWhy(ad, ["یاماها", "U3"], ["دیجیتال"]);
    expect(explanation?.present).toEqual(["یاماها", "U3"]);
    expect(explanation?.absentExcluded).toEqual(["دیجیتال"]);
    expect(explanation?.sentence).toContain("دیده شد");
    expect(explanation?.sentence).toContain("پیدا نشد");
  });

  it("returns null when nothing factual can be said", () => {
    expect(explainWhy(ad, [], [])).toBeNull();
  });
});

describe("sortResults", () => {
  const list = SEARCH_FIXTURES.map((ad) => ({ ad }));

  it("sorts cheapest first with unpriced last", () => {
    const sorted = sortResults(list, "cheap");
    expect(sorted[0].ad.price).toBe(42000000);
    expect(sorted[sorted.length - 1].ad.price).toBeNull();
  });

  it("sorts most expensive first with unpriced last", () => {
    const sorted = sortResults(list, "pricey");
    expect(sorted[0].ad.price).toBe(890000000);
    expect(sorted[sorted.length - 1].ad.price).toBeNull();
  });

  it("keeps match order by default", () => {
    expect(sortResults(list, "best").map((i) => i.ad.id)).toEqual(
      list.map((i) => i.ad.id)
    );
  });
});
