import { describe, expect, it } from "vitest";
import { auditHuntCoverage } from "./hunt-coverage-audit";
import { auditCoverageLayers } from "./coverage-layers-audit";
import {
  canonicalizeForMatch,
  findCanonicalCollisions,
  findC9FoldCollisions,
  stripClosedMorpheme,
} from "./persian-canonicalize";
import {
  renderIntentContract,
  slotMayReject,
  validateIntentContract,
  type IntentContract,
} from "./intent-contract";

describe("deterministic Persian canonicalization C1-C9", () => {
  it("C1 folds Alef variants only", () => {
    expect(canonicalizeForMatch("آ أ إ ٱ").canonical).toBe("ا ا ا ا");
  });

  it("C2 folds Arabic Yeh/Kaf and Teh Marbuta", () => {
    expect(canonicalizeForMatch("ي ك ة").canonical).toBe("ی ک ه");
    // Arabic Alef Maksura is not listed in C2; do not add an unrequested fold.
    expect(canonicalizeForMatch("ى").canonical).toBe("ى");
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

  it("activates C9a plural folding while keeping C9b comparative/superlative audit-only", () => {
    const corpus = new Set(["ماشین", "کتاب", "خوب", "بزرگ", "ارزان"]);
    for (const word of ["ماشینها", "ماشینهای"]) {
      expect(stripClosedMorpheme(word, corpus)).toBe("ماشین");
      expect(canonicalizeForMatch(word, { corpusTokens: corpus }).canonical).toBe("ماشین");
    }
    for (const word of ["کتابتر", "خوبترین", "بزرگترین", "ارزانتر"]) {
      expect(stripClosedMorpheme(word, corpus)).toBe(word);
      expect(canonicalizeForMatch(word, { corpusTokens: corpus }).canonical).toBe(word);
    }
    expect(stripClosedMorpheme("ماشینها", new Set())).toBe("ماشینها");
  });

  it("keeps protected forms, never strips standalone ی, and requires an observed base for C9a", () => {
    const corpus = new Set(["تن", "به", "به", "بیش", "کم", "علی", "کتاب"]);
    for (const word of ["تنها", "بهتر", "بهترین", "بیشتر", "کمتر"]) {
      expect(stripClosedMorpheme(word, corpus)).toBe(word);
    }
    expect(stripClosedMorpheme("کتابی", new Set(["کتاب"]))).toBe("کتابی");
    expect(stripClosedMorpheme("دوها", new Set(["دو"]))).toBe("دوها");
  });

  it("audits C9 folds separately from C1-C8 character folding", () => {
    expect(findCanonicalCollisions(["آباد", "اباد", "کتاب"])).toEqual([
      { canonical: "اباد", originals: ["آباد", "اباد"] },
    ]);
    expect(findC9FoldCollisions(["آباد", "اباد"])).toEqual([]);
    expect(findC9FoldCollisions(["کتاب", "کتابها"])).toEqual([
      { canonical: "کتاب", originals: ["کتاب", "کتابها"], preC9Forms: ["کتاب", "کتابها"], suffixClass: "C9a" },
    ]);
    expect(findC9FoldCollisions(["بزرگ", "بزرگترین"])).toEqual([
      { canonical: "بزرگ", originals: ["بزرگ", "بزرگترین"], preC9Forms: ["بزرگ", "بزرگترین"], suffixClass: "C9b" },
    ]);
    // If the remainder is not independently observed, C9 must not fold.
    expect(findC9FoldCollisions(["کتابها"])).toEqual([]);
  });
});



import frozenHunts from "./data/frozen-70-hunts.json";
import frozenPoolTitles from "./data/frozen-pool-titles.json";
import approvedContracts from "./data/draft-contracts-70.json";

describe("approved entity phrase C9a non-collision gate", () => {
  it("keeps all 70 entity values pairwise distinct under C1-C8 plus active C9a", () => {
    const corpusTokens = new Set<string>();
    for (const hunt of frozenHunts.hunts) {
      for (const token of canonicalizeForMatch(hunt.query).tokens) corpusTokens.add(token);
    }
    for (const ad of frozenPoolTitles.ads) {
      for (const token of canonicalizeForMatch(ad.title).tokens) corpusTokens.add(token);
    }

    const entities = approvedContracts.contracts.flatMap((contract) =>
      contract.entity.values.map((value) => ({
        huntId: contract.huntId,
        value,
        canonical: canonicalizeForMatch(value, { corpusTokens }).canonical,
      })),
    );
    expect(entities).toHaveLength(70);

    const collisions: Array<{ canonical: string; left: typeof entities[number]; right: typeof entities[number] }> = [];
    for (let left = 0; left < entities.length; left += 1) {
      for (let right = left + 1; right < entities.length; right += 1) {
        if (entities[left].canonical === entities[right].canonical) {
          collisions.push({
            canonical: entities[left].canonical,
            left: entities[left],
            right: entities[right],
          });
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});

describe("frozen hunt coverage audit", () => {
  it("detects missing contracts and any lost hard-slot source phrase", () => {
    const frozen = [
      { huntId: "H1", query: "ماشین سفید", hardSlotSourcePhrases: ["سفید"] },
      { huntId: "H2", query: "یخچال بدون خط", hardSlotSourcePhrases: ["بدون خط"] },
    ];
    const contracts: IntentContract[] = [
      {
        ...validContract,
        huntId: "H1",
        slots: [{ kind: "color", values: ["سفید"], polarity: "must", hardness: "hard", status: "confirmed", sourcePhrase: "سفید" }],
      },
    ];
    expect(auditHuntCoverage(frozen, contracts, 2)).toEqual([
      { huntId: "H2", kind: "missing-contract", detail: "no contract for frozen hunt" },
    ]);
    const changed: IntentContract[] = [
      ...contracts,
      {
        ...validContract,
        huntId: "H2",
        slots: [{ kind: "absence", values: ["خط"], polarity: "mustNot", hardness: "hard", status: "confirmed", sourcePhrase: "خط" }],
      },
    ];
    expect(auditHuntCoverage(frozen, changed, 2)).toContainEqual({
      huntId: "H2",
      kind: "missing-hard-slot",
      detail: "hard slot source phrase lost or changed: «بدون خط»",
    });
  });

  it("does not pass when the frozen source inventory is not exactly 70 hunts", () => {
    const issues = auditHuntCoverage([], [], 70);
    expect(issues).toContainEqual({
      huntId: "*",
      kind: "missing-source",
      detail: "expected 70 frozen hunts, received 0",
    });
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

describe("frozen status coverage audit", () => {
  const auditContract = (
    huntId: string,
    entityPhrase: string,
    slots: IntentContract["slots"],
  ): IntentContract => ({
    schemaVersion: "2.0",
    huntId,
    entity: { kind: "commodity", values: [entityPhrase], status: "confirmed", sourcePhrase: entityPhrase },
    slots,
    transactions: { values: [], status: "unknown", sourcePhrase: null },
    location: { value: null, status: "unknown", sourcePhrase: null },
    price: { min: null, max: null, currency: null, status: "unknown", sourcePhrase: null },
  });

  it("matches multiword status phrases canonically and preserves negative status polarity", () => {
    const hunts = [
      { huntId: "H-NEW", query: "کفش نو یا در حد نو" },
      { huntId: "H-USED", query: "موتور دست‌دوم" },
      { huntId: "H-REPAIR", query: "موتور نیازمند تعمیر" },
      { huntId: "H-NEGATIVE", query: "طلای شکسته، نه زیورآلات نو" },
    ];
    const contracts: IntentContract[] = [
      auditContract("H-NEW", "کفش", [
        { kind: "condition", values: ["نو", "در حد نو"], polarity: "must", hardness: "soft", status: "confirmed", sourcePhrase: "نو یا در حد نو" },
      ]),
      auditContract("H-USED", "موتور", [
        { kind: "condition", values: ["دست دوم"], polarity: "must", hardness: "soft", status: "confirmed", sourcePhrase: "دست‌دوم" },
      ]),
      auditContract("H-REPAIR", "موتور", [
        { kind: "condition", values: ["نیازمند تعمیر"], polarity: "must", hardness: "soft", status: "confirmed", sourcePhrase: "نیازمند تعمیر" },
      ]),
      auditContract("H-NEGATIVE", "طلای شکسته", [
        { kind: "descriptor", values: ["زیورآلات نو"], polarity: "mustNot", hardness: "hard", status: "confirmed", sourcePhrase: "نه زیورآلات نو" },
      ]),
    ];
    expect(auditCoverageLayers(hunts, contracts)).toEqual([]);
  });
});

describe("intent contract schema and readable audit", () => {
  it("accepts a complete contract without silently defaulting slot hardness", () => {
    expect(validateIntentContract(validContract)).toEqual([]);
  });

  it("does not treat an absent hardness marker as confirmed", () => {
    const invalid = {
      ...validContract,
      slots: [{ ...validContract.slots[0], hardness: null, status: "confirmed" }],
    } as unknown as IntentContract;
    expect(validateIntentContract(invalid)).toContainEqual({
      path: "slots[0].status",
      message: "missing hardness marker requires unknown status",
    });
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

  it("never lets unknown, soft, or condition slots reject; hard confirmed constraints may", () => {
    expect(slotMayReject(validContract.slots[0])).toBe(false); // unknown
    expect(slotMayReject(validContract.slots[2])).toBe(false); // soft preference
    expect(slotMayReject(validContract.slots[1])).toBe(true); // hard, confirmed, non-condition
    expect(slotMayReject({
      kind: "condition", values: ["نو"], polarity: "must", hardness: "hard",
      status: "confirmed", sourcePhrase: "نو",
    })).toBe(false);
  });

  it("renders every slot with polarity, hardness, status, alternatives, and source", () => {
    const lines = renderIntentContract(validContract);
    expect(lines).toHaveLength(7);
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
