import { describe, expect, it } from "vitest";
import {
  canonicalizeForMatch,
  findCanonicalCollisions,
  stripClosedMorpheme,
} from "./persian-canonicalize";
import {
  renderIntentContract,
  validateIntentContract,
  type IntentContract,
} from "./intent-contract";

describe("deterministic Persian canonicalization C1-C9", () => {
  it("C1 folds Alef variants only", () => {
    expect(canonicalizeForMatch("آأإٱ").canonical).toBe("ا ا ا ا");
  });

  it("C2 folds Arabic Yeh/Kaf and Teh Marbuta", () => {
    expect(canonicalizeForMatch("ي ى ك ة").canonical).toBe("ی ی ک ه");
  });

  it("C3 treats ZWNJ as a matching separator and preserves original input", () => {
    const result = canonicalizeForMatch("می‌روم");
    expect(result.canonical).toBe("می روم");
    expect(result.original).toBe("می‌روم");
  });

  it("C4 removes diacritics and tatweel", () => {
    expect(canonicalizeForMatch("مُـوبایِل").canonical).toBe("موبایل");
  });

  it("C5 maps Persian and Arabic digits to ASCII", () => {
    expect(canonicalizeForMatch("۱۲۳ ١٢٣").canonical).toBe("123 123");
  });

  it("C6 replaces punctuation with boundaries and collapses whitespace", () => {
    expect(canonicalizeForMatch("  پژو،   ۲۰۶! ").canonical).toBe("پژو 206");
    expect(canonicalizeForMatch("الف-ب").tokens).toEqual(["الف", "ب"]);
  });

  it("C7 lowercases Latin without transliterating", () => {
    expect(canonicalizeForMatch("PS4 AbC").canonical).toBe("ps4 abc");
    expect(canonicalizeForMatch("khodro").canonical).toBe("khodro");
  });

  it("C8 does not stem ordinary words, merge synonyms, or guess brand aliases", () => {
    expect(canonicalizeForMatch("ماشین خودرو").tokens).toEqual(["ماشین", "خودرو"]);
    expect(canonicalizeForMatch("ماشینها").tokens).toEqual(["ماشینها"]);
    expect(canonicalizeForMatch("PlayStation سونی").tokens).toEqual(["playstation", "سونی"]);
  });

  it("C9 strips ها/های/تر/ترین only when remainder is independently in corpus", () => {
    const corpus = new Set(["ماشین", "کتاب", "خوب"]);
    expect(stripClosedMorpheme("ماشینها", corpus)).toBe("ماشین");
    expect(stripClosedMorpheme("ماشینهای", corpus)).toBe("ماشین");
    expect(stripClosedMorpheme("کتابتر", corpus)).toBe("کتاب");
    expect(stripClosedMorpheme("خوبترین", corpus)).toBe("خوب");
    expect(stripClosedMorpheme("ماشینها", new Set())).toBe("ماشینها");
  });

  it("C9 protects listed words, requires at least three letters, and never strips ی", () => {
    const corpus = new Set(["تن", "به", "به", "بیش", "کم", "علی", "کتاب"]);
    for (const word of ["تنها", "بهتر", "بهترین", "بیشتر", "کمتر"]) {
      expect(stripClosedMorpheme(word, corpus)).toBe(word);
    }
    expect(stripClosedMorpheme("کتابی", new Set(["کتاب"]))).toBe("کتابی");
    expect(stripClosedMorpheme("دوها", new Set(["دو"]))).toBe("دوها");
  });

  it("collision audit reports distinct original words sharing a canonical form, including C9 folds", () => {
    expect(findCanonicalCollisions(["آباد", "اباد", "کتاب"])).toEqual([
      { canonical: "اباد", originals: ["آباد", "اباد"] },
    ]);
    expect(findCanonicalCollisions(["کتاب", "کتابها"])).toEqual([
      { canonical: "کتاب", originals: ["کتاب", "کتابها"] },
    ]);
    // If the remainder is not independently observed, C9 must not fold.
    expect(findCanonicalCollisions(["کتابها"])).toEqual([]);
  });
});

const validContract: IntentContract = {
  schemaVersion: "2.0",
  huntId: "H-TEST",
  entity: { kind: "commodity", values: ["ماشین"], status: "confirmed", sourcePhrase: "ماشین" },
  slots: [
    { kind: "condition", values: ["کارکرده", "دست دوم"], polarity: "must", hardness: null, status: "unknown", sourcePhrase: "کارکرده یا دست دوم" },
    { kind: "color", values: ["سفید"], polarity: "mustNot", hardness: "hard", status: "confirmed", sourcePhrase: "بدون سفید" },
    { kind: "comfort", values: ["کولر"], polarity: "must", hardness: "soft", status: "confirmed", sourcePhrase: "ترجیحاً کولر" },
  ],
  transactions: { values: ["buy", "sell"], status: "confirmed", sourcePhrase: "خرید یا فروش" },
  location: { value: "تهران", status: "confirmed", sourcePhrase: "تهران" },
  price: { min: 100, max: 200, currency: "تومان", status: "confirmed", sourcePhrase: "۱۰۰ تا ۲۰۰ تومان" },
};

describe("intent contract schema and readable audit", () => {
  it("accepts a complete contract without silently defaulting slot hardness", () => {
    expect(validateIntentContract(validContract)).toEqual([]);
  });

  it("rejects empty entity/slot values, missing source evidence, and reversed price bounds", () => {
    const bad = {
      ...validContract,
      entity: { ...validContract.entity, values: [], sourcePhrase: "" },
      slots: [{ ...validContract.slots[0], values: [], sourcePhrase: "" }],
      price: { ...validContract.price, min: 300, max: 100 },
    } as IntentContract;
    const paths = validateIntentContract(bad).map((issue) => issue.path);
    expect(paths).toContain("entity.values");
    expect(paths).toContain("entity.sourcePhrase");
    expect(paths).toContain("slots[0].values");
    expect(paths).toContain("slots[0].sourcePhrase");
    expect(paths).toContain("price");
  });

  it("renders every slot with polarity, hardness, status, alternatives, and source", () => {
    const lines = renderIntentContract(validContract);
    expect(lines).toHaveLength(6);
    expect(lines[1]).toContain("قطبیت: باید");
    expect(lines[1]).toContain("سختی: تعیین‌نشده");
    expect(lines[1]).toContain("وضعیت: نامشخص");
    expect(lines[1]).toContain("کارکرده یا دست دوم");
    expect(lines[2]).toContain("قطبیت: نباید");
    expect(lines[2]).toContain("سختی: سخت");
    expect(lines[3]).toContain("سختی: نرم");
    expect(lines.some((line) => line.startsWith("محل |"))).toBe(true);
    expect(lines.some((line) => line.startsWith("قیمت |"))).toBe(true);
  });
});
