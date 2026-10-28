import { describe, expect, it } from "vitest";
import {
  BM25_B,
  BM25_K1,
  canonicalizeFrozenCorpus,
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

