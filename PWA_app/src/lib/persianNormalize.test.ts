import { describe, expect, it } from "vitest";
import {
  expandSynonyms,
  normalizeForMatch,
  stemToken,
  textMatches,
  tokenize,
  unifyChars,
} from "./persianNormalize";

describe("unifyChars", () => {
  it("unifies Arabic Yeh/Kaf to Persian", () => {
    expect(unifyChars("موبايل كيبرد")).toBe("موبایل کیبرد");
  });
  it("strips diacritics and tatweel", () => {
    expect(unifyChars("مُوبایـل")).toBe("موبایل");
  });
  it("unifies Alef variants (آپارتمان vs اپارتمان — flaw #9)", () => {
    expect(unifyChars("آپارتمان")).toBe("اپارتمان");
    expect(unifyChars("مؤسسه")).toBe("موسسه");
    expect(unifyChars("رئیس")).toBe("رییس");
    expect(textMatches("اپارتمان ۹۰ متری نوساز", "آپارتمان")).toBe(true);
  });
});

describe("normalizeForMatch", () => {
  it("treats ZWNJ as separator and drops punctuation", () => {
    expect(normalizeForMatch("می‌روم، تهران!")).toBe("می روم تهران");
  });
});

describe("stemToken", () => {
  it("strips plural ها/های", () => {
    expect(stemToken("ماشین‌ها")).toBe("ماشین");
    expect(stemToken("ماشینهای")).toBe("ماشین");
  });
  it("strips indefinite ی but keeps short words intact", () => {
    expect(stemToken("ماشینی")).toBe("ماشین");
    expect(stemToken("علی")).toBe("علی"); // length guard
  });
  it("does NOT strip تر/ترین (unsafe: بهتر → به)", () => {
    expect(stemToken("بهتر")).toBe("بهتر");
  });
});

describe("tokenize", () => {
  it("normalizes an Arabic-keyboard ad to matchable tokens", () => {
    expect(tokenize("موبايل‌ها نو")).toEqual(["موبایل", "نو"]);
  });
});

describe("expandSynonyms", () => {
  it("expands bidirectionally (آپارتمان ↔ واحد)", () => {
    expect(expandSynonyms("آپارتمان")).toContain("واحد");
    // Canonical form is the normalized one (آ→ا since flaw #9).
    expect(expandSynonyms("واحد")).toContain("اپارتمان");
  });
  it("returns the term itself for unknown words", () => {
    expect(expandSynonyms("زرافه")).toEqual(["زرافه"]);
  });
});

describe("textMatches", () => {
  it("matches despite Arabic keyboard + plural in the ad", () => {
    expect(textMatches("فروش موبايل‌ها", "موبایل")).toBe(true);
  });
  it("matches synonyms (user: آپارتمان, ad: واحد)", () => {
    expect(textMatches("واحد ۸۰ متری نورگیر", "آپارتمان")).toBe(true);
  });
  it("matches multi-word phrases (تلفن همراه)", () => {
    expect(textMatches("تلفن همراه نو", "موبایل")).toBe(true);
  });
  it("does not match unrelated text", () => {
    expect(textMatches("یخچال فریزر نو", "موبایل")).toBe(false);
  });
  it("is empty-safe", () => {
    expect(textMatches("", "موبایل")).toBe(false);
  });
});
