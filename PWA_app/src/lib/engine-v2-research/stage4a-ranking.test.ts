import { describe, expect, it } from "vitest";
import {
  BM25_B,
  BM25_K1,
  RRF_K,
  canonicalizeFrozenCorpus,
  fuseBm25WithDense,
  rankBm25,
  rankFrozenTitlesByHunt,
  scoreBm25,
  type Bm25Document,
} from "./stage4a-ranking";

function doc(token: string, terms: string[], position: number): Bm25Document {
  return { huntId: "H01", position, token, title: terms.join(" "), terms };
}

describe("Stage 4a BM25 over canonicalized titles", () => {
  it("uses the standard BM25 IDF and term-frequency equation", () => {
    const corpus = [
      doc("a", ["alpha", "alpha", "beta"], 1),
      doc("b", ["alpha", "gamma"], 2),
      doc("c", ["beta", "gamma"], 3),
    ];
    const k1 = BM25_K1;
    const b = BM25_B;
    const averageLength = 7 / 3;
    const idf = Math.log(1 + (3 - 2 + 0.5) / (2 + 0.5));
    const normA = 1 - b + b * (3 / averageLength);
    const expectedA = idf * (2 * (k1 + 1)) / (2 + k1 * normA);
    const normB = 1 - b + b * (2 / averageLength);
    const expectedB = idf * (1 * (k1 + 1)) / (1 + k1 * normB);
    expect(scoreBm25(["alpha"], corpus[0], corpus)).toBeCloseTo(expectedA, 12);
    expect(scoreBm25(["alpha"], corpus[1], corpus)).toBeCloseTo(expectedB, 12);
    expect(scoreBm25(["alpha", "alpha"], corpus[1], corpus)).toBeCloseTo(expectedB, 12);
    expect(scoreBm25(["missing"], corpus[1], corpus)).toBe(0);
  });

  it("returns every candidate and breaks equal-score ties by frozen position", () => {
    const corpus = [doc("first", ["unrelated"], 1), doc("second", ["unrelated"], 2)];
    expect(rankBm25(["absent"], corpus, corpus).map((item) => item.token)).toEqual(["first", "second"]);
  });

  it("uses the Stage 2 canonicalizer for Persian digits and punctuation", () => {
    const hunts = [{ huntId: "H01", query: "دوچرخه، ۲۶ اینچ" }];
    const ads = [
      { huntId: "H01", position: 1, title: "دوچرخه 26 اینچ", adToken: "good" },
      { huntId: "H01", position: 2, title: "موتور ۱۲۵", adToken: "other" },
    ];
    const canonical = canonicalizeFrozenCorpus(hunts, ads);
    expect(canonical.queryTerms.get("H01")).toContain("26");
    expect(canonical.documents[0].terms).toContain("26");
    expect(rankFrozenTitlesByHunt(hunts, ads).H01[0]).toBe("good");
  });
});

describe("Stage 4a reciprocal-rank fusion", () => {
  it("uses 1/(k+rank) with 1-based ranks and the unadjusted k=60", () => {
    const result = fuseBm25WithDense(
      { H01: ["a", "b"] },
      { H01: [{ token: "b", score: 0.9 }, { token: "a", score: 0.2 }] },
    ).H01;
    expect(RRF_K).toBe(60);
    expect(result.find((entry) => entry.token === "a")?.score).toBeCloseTo(1 / 61 + 1 / 62, 12);
    expect(result.find((entry) => entry.token === "b")?.score).toBeCloseTo(1 / 62 + 1 / 61, 12);
    expect(result.map((entry) => entry.token)).toEqual(["a", "b"]);
  });

  it("keeps the full union; fusion never filters candidates or applies a top-N cutoff", () => {
    const bm25 = { H01: ["a", "b", "c"], H02: ["x"] };
    const dense = {
      H01: [{ token: "c", score: 0.99 }, { token: "d", score: 0.88 }, { token: "a", score: 0.77 }],
      H03: [{ token: "z", score: 0.5 }],
    };
    const fused = fuseBm25WithDense(bm25, dense);
    expect(fused.H01.map((entry) => entry.token).sort()).toEqual(["a", "b", "c", "d"]);
    expect(fused.H01).toHaveLength(4);
    expect(fused.H02.map((entry) => entry.token)).toEqual(["x"]);
    expect(fused.H03.map((entry) => entry.token)).toEqual(["z"]);
    expect(fused.H01.every((entry) => Number.isFinite(entry.score))).toBe(true);
  });

  it("sorts dense scores descending before assigning RRF ranks", () => {
    const fused = fuseBm25WithDense(
      { H01: ["a", "b"] },
      { H01: [{ token: "b", score: 0.2 }, { token: "a", score: 0.8 }] },
    );
    expect(fused.H01.find((entry) => entry.token === "a")?.denseRank).toBe(1);
    expect(fused.H01.find((entry) => entry.token === "b")?.denseRank).toBe(2);
  });

  it("rejects invalid RRF k rather than silently changing it", () => {
    expect(() => fuseBm25WithDense({ H01: ["a"] }, {}, -1)).toThrow(RangeError);
  });
});
