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
    // Labels a=3,b=2,c=0,d=1: the true ideal top-3 is a,b,d (3,2,1).
    // Using c (0) in third place is measurably sub-ideal (nDCG ~0.947).
    const ideal = evaluateRanking(["a", "b", "d"], labels, 3).ndcgAtK;
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

describe("benchmark hard negatives (human-reviewed, versioned)", () => {
  function byId(id: string) {
    const found = SEARCH_QUALITY_BENCHMARK.find((c) => c.id === id);
    if (!found) throw new Error(`missing case ${id}`);
    return found;
  }
  function grade(caseId: string, candId: string): number {
    const c = byId(caseId);
    const cand = c.candidates.find((x) => x.id === candId);
    if (!cand) throw new Error(`missing candidate ${candId}`);
    return cand.relevance;
  }

  it("locks product-vs-service labels", () => {
    expect(grade("service-product-fridge", "srv-p1")).toBe(3);
    expect(grade("service-product-fridge", "srv-p2")).toBe(0);
  });

  it("locks buyer-vs-seller labels", () => {
    expect(grade("direction-buyer-seller-fridge", "dir-s1")).toBe(3);
    expect(grade("direction-buyer-seller-fridge", "dir-b1")).toBe(0);
    expect(grade("direction-buyer-seller-fridge", "dir-u1")).toBe(2);
  });

  it("locks exact-vs-related labels", () => {
    expect(grade("exact-related-cooler", "cool-e1")).toBe(3);
    expect(grade("exact-related-cooler", "cool-r1")).toBe(1);
    expect(grade("exact-related-cooler", "cool-w1")).toBe(0);
  });

  it("locks negated-term labels", () => {
    expect(grade("negation-digital-piano", "negp-e1")).toBe(3);
    expect(grade("negation-digital-piano", "negp-h1")).toBe(0);
    expect(grade("negation-digital-piano", "negp-n1")).toBe(1);
  });
});

describe("benchmark quality report (deterministic reference ranker only)", () => {
  it("computes per-slice Precision@3, Recall@3, nDCG@3 for reference (not pipeline metrics)", () => {
    const K = 3;
    // Reference-only ranker using 2-arg textMatches so this file stays
    // runnable on both main and category-aware branches. Never label these
    // as production-pipeline metrics.
    const perSlice = new Map<string, { p: number[]; r: number[]; n: number[]; cases: number }>();
    for (const c of SEARCH_QUALITY_BENCHMARK) {
      const scored = c.candidates.map((cand, idx) => {
        const hay = `${cand.title} ${cand.description}`;
        let s = 0;
        for (const t of c.intent.must) if (textMatches(hay, t)) s += 1;
        let penalized = false;
        for (const t of c.intent.mustNot) if (textMatches(hay, t)) penalized = true;
        return { id: cand.id, s: penalized ? -1 : s, idx };
      });
      scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
      const labels: Record<string, number> = {};
      for (const cand of c.candidates) labels[cand.id] = cand.relevance;
      const m = evaluateRanking(scored.map((x) => x.id), labels, K);
      expect(m.precisionAtK).toBeGreaterThanOrEqual(0);
      expect(m.precisionAtK).toBeLessThanOrEqual(1);
      expect(m.ndcgAtK).toBeGreaterThanOrEqual(0);
      expect(m.ndcgAtK).toBeLessThanOrEqual(1);
      const agg = perSlice.get(c.slice) ?? { p: [], r: [], n: [], cases: 0 };
      agg.p.push(m.precisionAtK);
      if (m.recallAtK !== null) agg.r.push(m.recallAtK);
      agg.n.push(m.ndcgAtK);
      agg.cases += 1;
      perSlice.set(c.slice, agg);
    }
    const report: Record<string, { cases: number; pAt3: number; rAt3: number | null; ndcgAt3: number }> = {};
    for (const [slice, agg] of perSlice) {
      const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
      report[slice] = {
        cases: agg.cases,
        pAt3: Number(avg(agg.p).toFixed(4)),
        rAt3: agg.r.length === 0 ? null : Number(avg(agg.r).toFixed(4)),
        ndcgAt3: Number(avg(agg.n).toFixed(4)),
      };
    }
    console.log("BENCHMARK_SLICE_REPORT_K3=" + JSON.stringify(report));
  });
});
