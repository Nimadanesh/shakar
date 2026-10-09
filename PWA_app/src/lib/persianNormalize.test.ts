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
  it("expands exact aliases only when the category is applicable", () => {
    expect(expandSynonyms("آپارتمان", "real-estate")).toContain("واحد");
    // Canonical form is normalized (آ→ا since flaw #9).
    expect(expandSynonyms("واحد", "real-estate")).toContain("اپارتمان");
    expect(expandSynonyms("آپارتمان", "all")).toEqual(["اپارتمان"]);
  });

  it("does not expand related-but-distinct concepts", () => {
    expect(expandSynonyms("آپارتمان", "real-estate")).not.toContain("سوئیت");
    expect(expandSynonyms("پیانو", "music")).not.toContain("کیبورد");
    expect(expandSynonyms("یخچال", "home")).not.toContain("فریزر");
    expect(expandSynonyms("کولر", "home")).not.toContain("اسپیلت");
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
    expect(textMatches("واحد ۸۰ متری نورگیر", "آپارتمان", "real-estate")).toBe(true);
  });
  it("matches multi-word phrases (تلفن همراه)", () => {
    expect(textMatches("تلفن همراه نو", "موبایل", "mobile")).toBe(true);
  });
  it("does not match unrelated text", () => {
    expect(textMatches("یخچال فریزر نو", "موبایل")).toBe(false);
  });

  it("keeps related household/music concepts distinct", () => {
    expect(textMatches("سوئیت ۹۰ متری", "آپارتمان", "real-estate")).toBe(false);
    expect(textMatches("کیبورد آموزشی", "پیانو", "music")).toBe(false);
    expect(textMatches("فریزر صندوقی", "یخچال", "home")).toBe(false);
    expect(textMatches("اسپیلت ۲۴ هزار", "کولر", "home")).toBe(false);
  });

  it("still matches a genuinely combined refrigerator-freezer listing", () => {
    expect(textMatches("یخچال فریزر سالم", "یخچال", "home")).toBe(true);
  });
  it("is empty-safe", () => {
    expect(textMatches("", "موبایل")).toBe(false);
  });
});
