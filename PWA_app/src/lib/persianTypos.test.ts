import { describe, expect, it } from "vitest";
import {
  isKnownWord,
  keyboardNeighbors,
  suggestTypoFix,
} from "./persianTypos";

describe("keyboardNeighbors", () => {
  it("knows گ and ک are adjacent (navid's نورگیر → نورکیر case)", () => {
    expect(keyboardNeighbors("گ")).toContain("ک");
    expect(keyboardNeighbors("ک")).toContain("گ");
  });

  it("returns empty for unknown characters", () => {
    expect(keyboardNeighbors("x")).toEqual([]);
  });
});

describe("suggestTypoFix", () => {
  it("fixes navid's example: نورکیر → نورگیر", () => {
    expect(suggestTypoFix("نورکیر")).toBe("نورگیر");
  });

  it("fixes a transposition typo", () => {
    // نروگیر (ر/و swapped) → نورگیر
    expect(suggestTypoFix("نروگیر")).toBe("نورگیر");
  });

  it("returns null for correct words", () => {
    expect(suggestTypoFix("نورگیر")).toBeNull();
    expect(suggestTypoFix("تهران")).toBeNull();
    expect(suggestTypoFix("آپارتمان")).toBeNull();
  });

  it("returns null for short words", () => {
    expect(suggestTypoFix("تا")).toBeNull();
    expect(suggestTypoFix("نو")).toBeNull();
  });

  it("returns null for model numbers and latin", () => {
    expect(suggestTypoFix("U3")).toBeNull();
    expect(suggestTypoFix("206")).toBeNull();
    expect(suggestTypoFix("۲۵۶")).toBeNull();
  });

  it("returns null when nothing is within one edit", () => {
    expect(suggestTypoFix("ققققق")).toBeNull();
  });
});

describe("isKnownWord", () => {
  it("accepts known words and skipped classes", () => {
    expect(isKnownWord("نورگیر")).toBe(true);
    expect(isKnownWord("تا")).toBe(true);
    expect(isKnownWord("U3")).toBe(true);
  });

  it("rejects a typo", () => {
    expect(isKnownWord("نورکیر")).toBe(false);
  });
});
