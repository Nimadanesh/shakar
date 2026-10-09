import { describe, expect, it } from "vitest";
import { normalizeForMatch, textMatches, tokenize } from "@/lib/persianNormalize";
import {
  evaluateRanking,
  SEARCH_QUALITY_BENCHMARK,
  SEARCH_QUALITY_BENCHMARK_VERSION,
} from "./search-quality-benchmark";

describe("search quality benchmark dataset", () => {
  it("has a versioned, non-empty, uniquely identified query set with hard-negative labels", () => {
    expect(SEARCH_QUALITY_BENCHMARK_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/);
    expect(SEARCH_QUALITY_BENCHMARK.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SEARCH_QUALITY_BENCHMARK.map((item) => item.id)).size).toBe(SEARCH_QUALITY_BENCHMARK.length);
    for (const item of SEARCH_QUALITY_BENCHMARK) {
      expect(item.query.trim()).not.toBe("");
      expect(item.candidates.length).toBeGreaterThanOrEqual(3);
      expect(new Set(item.candidates.map((candidate) => candidate.id)).size).toBe(item.candidates.length);
      expect(item.candidates.some((candidate) => candidate.relevance === 0)).toBe(true);
      expect(item.candidates.some((candidate) => candidate.relevance >= 2)).toBe(true);
    }
  });

  it("covers the required quality slices", () => {
    const slices = new Set(SEARCH_QUALITY_BENCHMARK.map((item) => item.slice));
    for (const slice of [
      "normalization", "entity-collision", "model-identifier", "negation",
      "preference", "location", "price", "condition", "transaction",
      "unknown", "ambiguity", "duplicates",
    ]) expect(slices.has(slice as never)).toBe(true);
  });
});

describe("search quality metric calculations", () => {
  const labels = { a: 3, b: 2, c: 0, d: 1 };

  it("calculates Precision@K using the fixed K denominator", () => {
    expect(evaluateRanking(["a", "c"], labels, 3).precisionAtK).toBeCloseTo(1 / 3);
  });

  it("calculates Recall@K against all judged relevant candidates in the fixture pool", () => {
    const metrics = evaluateRanking(["c", "a"], labels, 2);
    expect(metrics.relevantInPool).toBe(2);
    expect(metrics.relevantReturned).toBe(1);
    expect(metrics.recallAtK).toBeCloseTo(0.5);
  });

  it("rewards better ordering with nDCG@K", () => {
    const ideal = evaluateRanking(["a", "b", "c"], labels, 3).ndcgAtK;
    const poor = evaluateRanking(["c", "b", "a"], labels, 3).ndcgAtK;
    expect(ideal).toBeGreaterThan(poor);
    expect(ideal).toBeCloseTo(1);
  });

  it("returns null recall when the judged pool contains no relevant candidates", () => {
    expect(evaluateRanking(["c"], { c: 0 }, 5).recallAtK).toBeNull();
  });
});

describe("benchmark fixture smoke checks against current Persian matching", () => {
  it("keeps core spelling and token-normalization positives as regression anchors", () => {
    expect(textMatches("اپارتمان ۹۰ متری نوساز", "آپارتمان")).toBe(true);
    expect(textMatches("فروش موبايل‌ها", "موبایل", "mobile")).toBe(true);
    expect(normalizeForMatch("می‌روم، تهران!")).toBe("می روم تهران");
    expect(tokenize("ماشین‌ها")).toContain("ماشین");
  });
});
