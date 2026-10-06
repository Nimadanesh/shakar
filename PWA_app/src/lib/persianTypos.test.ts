import { describe, expect, it } from "vitest";
import {
  applyTypoFixToText,
  isKnownWord,
  keyboardNeighbors,
  suggestTypoFix,
} from "./persianTypos";
import { findTypoHit, isTypoDismissed } from "@/components/search/TypoNudge";

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

  it("fixes lazy truncation via double insertion: پین → پیانو", () => {
    // navid's flakiness report: «پین» is 2 edits from «پیانو», so the old
    // 1-edit-only engine never suggested it. The truncation tier does.
    expect(suggestTypoFix("پین")).toBe("پیانو");
    expect(suggestTypoFix("آپارتما")).toBe("آپارتمان");
  });

  it("keeps 1-edit typos ahead of truncation candidates", () => {
    // «خون» is 1 insertion from «خونه» — that must win, not a longer word.
    expect(suggestTypoFix("خون")).toBe("خونه");
  });

  it("does not force a truncation match when the length guard excludes it", () => {
    // «موبایل» is 6 chars; «مبل» + 2 = 5, so it can never match.
    expect(suggestTypoFix("مبل")).toBeNull();
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

describe("applyTypoFixToText", () => {
  it("replaces the first matching token only", () => {
    expect(applyTypoFixToText("پین یاماها پین", "پین", "پیانو")).toBe(
      "پیانو یاماها پین"
    );
  });

  it("matches despite script variants", () => {
    expect(applyTypoFixToText("نوركیر تهران", "نورکیر", "نورگیر")).toBe(
      "نورگیر تهران"
    );
  });
});

describe("isTypoDismissed", () => {
  it("stands while the dismissed word is still in the query", () => {
    expect(isTypoDismissed("پین یاماها", "پین", "پین")).toBe(true);
  });

  it("resets once the query no longer contains the word (fresh chance)", () => {
    // navid's bug: a dismissal silenced the word for the whole session.
    expect(isTypoDismissed("", "پین", null)).toBe(false);
    expect(isTypoDismissed("خون", "پین", "خون")).toBe(false);
  });

  it("does not suppress a different suspicious word", () => {
    expect(isTypoDismissed("خون پین", "پین", "خون")).toBe(false);
  });
});

describe("findTypoHit — natural typing behavior", () => {
  it("never nags the word being typed (no trailing space, still typing)", () => {
    expect(findTypoHit("پین", false)).toBeNull();
    expect(findTypoHit("نورکیر", false)).toBeNull();
  });

  it("nudges the last word once the user pauses", () => {
    expect(findTypoHit("پین", true)?.fix).toBe("پیانو");
    expect(findTypoHit("نورکیر", true)?.fix).toBe("نورگیر");
  });

  it("nudges a finished word (trailing space) immediately, no pause needed", () => {
    expect(findTypoHit("نورکیر ", false)?.fix).toBe("نورگیر");
  });

  it("checks earlier finished words while the last one is still forming", () => {
    const hit = findTypoHit("نورکیر تهر", false);
    expect(hit?.word).toBe("نورکیر");
    expect(hit?.fix).toBe("نورگیر");
  });

  it("stays silent for clean input", () => {
    expect(findTypoHit("پیانو", true)).toBeNull();
    expect(findTypoHit("خونه 50 متری تهران", true)).toBeNull();
    expect(findTypoHit("", true)).toBeNull();
    expect(findTypoHit("   ", false)).toBeNull();
  });
});
