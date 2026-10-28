import { describe, expect, it } from "vitest";
import approvedContracts from "./data/draft-contracts-70.json";
import frozenCityMap from "./divar-cities.json";
import type { IntentContract } from "./intent-contract";
import { deriveStage3QueryPlan } from "./stage3-query-plan";

const contracts = approvedContracts.contracts as IntentContract[];

describe("Stage 3 deterministic query derivation", () => {
  const plan = deriveStage3QueryPlan(contracts, frozenCityMap.cities);

  it("splits entity phrases on every exact ' یا ' and preserves deterministic base-query order", () => {
    const h03 = plan.entries.filter((entry) => entry.huntId === "H03" && entry.kind === "base");
    expect(h03.map((entry) => entry.query)).toEqual([
      "پلی‌استیشن ۴ اسلیم ۵۰۰ گیگ",
      "۱ ترابایت",
    ]);
    expect(h03.map((entry) => entry.order)).toEqual([...h03.map((entry) => entry.order)].sort((a, b) => a - b));
    expect(plan.summary.baseQueries).toBe(137);
  });

  it("uses the Cartesian product for hard multi-valued slots in file order", () => {
    for (const huntId of ["H07", "H19"]) {
      const narrow = plan.entries.filter((entry) => entry.huntId === huntId && entry.kind === "narrow" && entry.status === "queued");
      expect(narrow).toHaveLength(4);
    }
    expect(plan.entries.filter((entry) => entry.huntId === "H07" && entry.kind === "narrow" && entry.status === "queued").map((entry) => entry.query)).toEqual([
      "قالی‌شویی در محل برای فرش دستباف",
      "قالی‌شویی در محل برای فرش ماشینی",
      "کارخانه برای فرش دستباف",
      "کارخانه برای فرش ماشینی",
    ]);
    expect(plan.entries.filter((entry) => entry.huntId === "H19" && entry.kind === "narrow" && entry.status === "queued").map((entry) => entry.query)).toEqual([
      "کتاب کمک‌درسی کنکور رشته تجربی مجموعه کامل",
      "کتاب کمک‌درسی کنکور رشته تجربی تک‌جلد سالم",
      "ریاضی مجموعه کامل",
      "ریاضی تک‌جلد سالم",
    ]);
  });

  it("emits exactly 28 narrow queries and records no-new-word combinations as skipped duplicates", () => {
    expect(plan.summary.narrowQueries).toBe(28);
    expect(plan.summary.emittedQueries).toBe(165);
    expect(plan.summary.emittedQueries).toBe(plan.summary.baseQueries + plan.summary.narrowQueries);
    const skipped = plan.entries.filter((candidate) => candidate.status === "skipped-duplicate");
    const noHardSlots = skipped.filter((entry) => entry.reason === "no-hard-spec-slots");
    const tokenDuplicates = skipped.filter((entry) => entry.reason === "adds-no-new-words");
    expect(noHardSlots).toHaveLength(113);
    expect(skipped).toHaveLength(113 + tokenDuplicates.length);
    expect(skipped.every((entry) => entry.kind === "narrow")).toBe(true);
  });

  it("never creates query text from mustNot, soft, condition, location, category, or price constraints", () => {
    const h01 = plan.entries.filter((entry) => entry.huntId === "H01");
    expect(h01.some((entry) => entry.query.includes("بچه‌گانه") || entry.query.includes("برقی"))).toBe(false);

    const h02 = plan.entries.filter((entry) => entry.huntId === "H02");
    expect(h02.some((entry) => entry.query.includes("دوچرخه ثابت") || entry.query.includes("ترجیحاً زیر ۲۰ میلیون"))).toBe(false);

    const h06 = plan.entries.filter((entry) => entry.huntId === "H06");
    expect(h06.every((entry) => !entry.query.includes("تهران") && !entry.query.includes("اطراف"))).toBe(true);

    for (const entry of plan.entries) {
      expect(entry.query).not.toContain("ترجیحاً");
      expect(entry.query).not.toContain("زیر ۲۰ میلیون");
    }
  });

  it("filters cities only from hard, confirmed location slots and maps every component", () => {
    const first = (huntId: string) => plan.entries.find((entry) => entry.huntId === huntId);
    for (const huntId of ["H01", "H05", "H09", "H14", "H20", "H21", "H24", "H33", "H35", "H37", "H51", "H57", "H64"]) {
      expect(first(huntId)?.city_ids, huntId).toBeNull();
    }
    for (const huntId of ["H07", "H12", "H17", "H26", "H47", "H53", "H56", "H60", "H66", "H70"]) {
      expect(first(huntId)?.city_ids, huntId).toEqual(["1"]);
    }
    expect(first("H13")?.city_ids).toEqual(["1", "2"]);
    expect(first("H06")?.city_ids).toEqual(["1"]);
    expect(first("H29")?.city_ids).toEqual(["1"]);

    const noLocationSlot: IntentContract = {
      ...contracts[0],
      huntId: "SYNTHETIC-NO-LOCATION-SLOT",
      slots: contracts[0].slots.filter((slot) => slot.kind !== "location"),
    };
    expect(deriveStage3QueryPlan([noLocationSlot], frozenCityMap.cities).entries[0].city_ids).toBeNull();
  });

  it("unions all IDs for a canonical city name and deduplicates repeated IDs", () => {
    const synthetic: IntentContract = {
      ...contracts[0],
      huntId: "SYNTHETIC-CITY-UNION",
      slots: [{
        kind: "location",
        values: ["تهران یا تهران"],
        polarity: "must",
        hardness: "hard",
        status: "confirmed",
        sourcePhrase: "تهران یا تهران",
      }],
    };
    const result = deriveStage3QueryPlan([synthetic], { tehran: "1" });
    expect(result.entries[0].city_ids).toEqual(["1"]);
  });

  it("fails closed and reports a known slug missing from the frozen numeric map", () => {
    const synthetic: IntentContract = {
      ...contracts[0],
      huntId: "SYNTHETIC-UNMAPPED-CITY",
      slots: [{
        kind: "location",
        values: ["تهران"],
        polarity: "must",
        hardness: "hard",
        status: "confirmed",
        sourcePhrase: "تهران",
      }],
    };
    const result = deriveStage3QueryPlan([synthetic], {});
    expect(result.entries[0].city_ids).toBeNull();
    expect(result.unmappedCitySlugs).toEqual(["tehran"]);
  });

  it("splits OR alternatives inside each specification-slot value before combinations", () => {
    const synthetic: IntentContract = {
      ...contracts[0],
      huntId: "SYNTHETIC-SPEC-OR",
      entity: { ...contracts[0].entity, values: ["دستگاه"] },
      slots: [{
        kind: "variant",
        values: ["سالم یا نو"],
        polarity: "must",
        hardness: "hard",
        status: "confirmed",
        sourcePhrase: "سالم یا نو",
      }, {
        kind: "model",
        values: ["مدل الف"],
        polarity: "must",
        hardness: "hard",
        status: "confirmed",
        sourcePhrase: "مدل الف",
      }],
    };
    const result = deriveStage3QueryPlan([synthetic], frozenCityMap.cities);
    expect(result.entries.filter((entry) => entry.kind === "narrow").map((entry) => entry.query)).toEqual([
      "دستگاه سالم مدل الف",
      "دستگاه نو مدل الف",
    ]);
  });
  it("records a narrow query as skipped-duplicate when its hard phrase adds no new canonical words", () => {
    const synthetic: IntentContract = {
      ...contracts[0],
      huntId: "SYNTHETIC-DUPLICATE",
      entity: { ...contracts[0].entity, values: ["دوچرخه کوهستان"] },
      slots: [{
        kind: "descriptor",
        values: ["کوهستان دوچرخه"],
        polarity: "must",
        hardness: "hard",
        status: "confirmed",
        sourcePhrase: "کوهستان دوچرخه",
      }],
      location: { value: null, status: "unknown", sourcePhrase: null },
    };
    const result = deriveStage3QueryPlan([synthetic], frozenCityMap.cities);
    expect(result.summary).toEqual({
      baseQueries: 1,
      narrowQueries: 0,
      skippedDuplicate: 1,
      emittedQueries: 1,
      shortQueries: 0,
      totalEmittedQueries: 1,
    });
    expect(result.entries[1]).toMatchObject({
      kind: "narrow",
      query: "دوچرخه کوهستان کوهستان دوچرخه",
      status: "skipped-duplicate",
      reason: "adds-no-new-words",
    });
  });

  it("logs every narrow decision, including no-hard-spec-slots, in strictly increasing order", () => {
    const skipped = plan.entries.filter((entry) => entry.status === "skipped-duplicate");
    expect(new Set(skipped.map((entry) => entry.order)).size).toBe(skipped.length);
    expect(plan.entries.map((entry) => entry.order)).toEqual(plan.entries.map((entry) => entry.order).sort((a, b) => a - b));
    expect(plan.entries.filter((entry) => entry.reason === "no-hard-spec-slots")).toHaveLength(113);

    const bases = plan.entries.filter((entry) => entry.kind === "base");
    for (const base of bases) {
      expect(plan.entries.some((entry) =>
        entry.kind === "narrow" &&
        entry.huntId === base.huntId &&
        entry.entityAlternativeIndex === base.entityAlternativeIndex &&
        entry.order > base.order &&
        (entry.status === "queued" || entry.status === "skipped-duplicate")
      ), base.huntId + ":" + base.entityAlternativeIndex).toBe(true);
    }
    expect(skipped.every((entry) =>
      entry.reason === "adds-no-new-words" || entry.reason === "no-hard-spec-slots"
    )).toBe(true);
  });
});
