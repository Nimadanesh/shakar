import { describe, expect, it } from "vitest";
import approvedContracts from "./data/draft-contracts-70.json";
import { DIVAR_CITIES } from "../divarCities";
import type { IntentContract } from "./intent-contract";
import { deriveStage3QueryPlan } from "./stage3-query-plan";

const contracts = approvedContracts.contracts as IntentContract[];

describe("Stage 3 deterministic query derivation", () => {
  const plan = deriveStage3QueryPlan(contracts, DIVAR_CITIES);

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
    for (const entry of plan.entries.filter((candidate) => candidate.status === "skipped-duplicate")) {
      expect(entry.kind).toBe("narrow");
      expect(entry.reason).toBe("adds-no-new-words");
    }
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

  it("uses city_ids only for confirmed locations whose every OR component maps exactly", () => {
    const first = (huntId: string) => plan.entries.find((entry) => entry.huntId === huntId);
    expect(first("H13")?.city_ids).toEqual(["tehran", "karaj"]);
    for (const huntId of ["H06", "H29", "H35"]) {
      expect(first(huntId)?.city_ids).toBeNull();
    }

    const unknownLocation = contracts.find((contract) => contract.location.status === "unknown");
    expect(unknownLocation).toBeDefined();
    expect(deriveStage3QueryPlan([unknownLocation!], DIVAR_CITIES).entries.every((entry) => entry.city_ids === null)).toBe(true);
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
    const result = deriveStage3QueryPlan([synthetic], []);
    expect(result.summary).toEqual({
      baseQueries: 1,
      narrowQueries: 0,
      skippedDuplicate: 1,
      emittedQueries: 1,
    });
    expect(result.entries[1]).toMatchObject({
      kind: "narrow",
      query: "دوچرخه کوهستان کوهستان دوچرخه",
      status: "skipped-duplicate",
      reason: "adds-no-new-words",
    });
  });

  it("logs each skipped duplicate in order without silently dropping it", () => {
    const skipped = plan.entries.filter((entry) => entry.status === "skipped-duplicate");
    expect(new Set(skipped.map((entry) => entry.order)).size).toBe(skipped.length);
    expect(plan.entries.map((entry) => entry.order)).toEqual(plan.entries.map((entry) => entry.order).sort((a, b) => a - b));
  });
});
