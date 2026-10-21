import { describe, expect, it } from "vitest";

import { buildLabelPool, evaluateRankingActual } from "./recall-metrics";
import { evaluateRanking } from "./search-quality-benchmark";

describe("evaluateRankingActual denominators", () => {
  const labels = { a: 3, b: 2, c: 0, d: 1 };

  it("scores ordinary full-K results like the benchmark", () => {
    const m = evaluateRankingActual(["a", "c", "b", "d", "x"], labels, 5);
    expect(m.returned).toBe(5);
    expect(m.precisionAtK).toBeCloseTo(2 / 5);
    expect(m.relevantReturned).toBe(2);
    expect(m.relevantInPool).toBe(2);
    expect(m.recallAtK).toBeCloseTo(1);
  });

  it("uses the actual returned count when fewer than K results exist", () => {
    // Fixed-K would score 1/5 = 0.2; the actual denominator is 1.
    const m = evaluateRankingActual(["a"], labels, 5);
    expect(m.returned).toBe(1);
    expect(m.precisionAtK).toBeCloseTo(1);
    expect(m.recallAtK).toBeCloseTo(0.5);
  });

  it("defines the empty-result case explicitly instead of scoring 0/0", () => {
    const empty = evaluateRankingActual([], labels, 5);
    expect(empty.returned).toBe(0);
    expect(empty.precisionAtK).toBeNull();
    // Nothing returned against a relevant pool is a total miss.
    expect(empty.recallAtK).toBe(0);
    expect(empty.ndcgAtK).toBe(0);
  });

  it("returns null recall when the pool has no relevant items", () => {
    const m = evaluateRankingActual(["c"], { c: 0 }, 5);
    expect(m.precisionAtK).toBeCloseTo(0);
    expect(m.recallAtK).toBeNull();
  });

  it("treats unjudged ids as grade 0", () => {
    const m = evaluateRankingActual(["zzz"], labels, 5);
    expect(m.relevantReturned).toBe(0);
    expect(m.precisionAtK).toBeCloseTo(0);
  });
});

describe("buildLabelPool dedupe policy", () => {
  it("counts an intentional repost once and reports it", () => {
    const { labels, skippedReposts } = buildLabelPool([
      { id: "dup-a1", relevance: 3 },
      { id: "dup-a1-repost", relevance: 3, repostOf: "dup-a1" },
      { id: "dup-a2", relevance: 1 },
    ]);
    expect(labels).toEqual({ "dup-a1": 3, "dup-a2": 1 });
    expect(skippedReposts).toEqual(["dup-a1-repost"]);
  });

  it("keeps the first occurrence of a duplicate id", () => {
    const { labels } = buildLabelPool([
      { id: "x", relevance: 3 },
      { id: "x", relevance: 0 },
    ]);
    expect(labels).toEqual({ x: 3 });
  });
});

describe("benchmark vs harness precision contract (pinned distinction)", () => {
  // The seed benchmark's evaluateRanking uses a FIXED-K precision
  // denominator by design (fewer-than-K results score relevantReturned/K).
  // The investigation harness uses evaluateRankingActual instead (actual
  // returned). Both contracts are intentional; this test pins the
  // difference so neither can silently drift into the other.
  it("one relevant result at K=5 scores 1/5 fixed-K but 1/1 actual", () => {
    const labels = { a: 3, b: 2 };
    expect(evaluateRanking(["a"], labels, 5).precisionAtK).toBeCloseTo(1 / 5);
    expect(evaluateRankingActual(["a"], labels, 5).precisionAtK).toBeCloseTo(1);
  });

  it("full-K results agree on precision", () => {
    const labels = { a: 3, b: 2, c: 0, d: 1, e: 0 };
    const ranked = ["a", "c", "b", "d", "e"];
    expect(evaluateRanking(ranked, labels, 5).precisionAtK).toBeCloseTo(
      evaluateRankingActual(ranked, labels, 5).precisionAtK ?? -1
    );
  });

  it("empty results score 0 fixed-K but null actual", () => {
    const labels = { a: 3, b: 2 };
    expect(evaluateRanking([], labels, 5).precisionAtK).toBe(0);
    expect(evaluateRankingActual([], labels, 5).precisionAtK).toBeNull();
  });
});
