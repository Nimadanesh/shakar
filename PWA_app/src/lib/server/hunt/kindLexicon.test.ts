import { describe, expect, it } from "vitest";
import {
  adKindForTitle,
  kindGateRejects,
  queryKindForDef,
  targetKindForDef,
} from "./kindLexicon";

describe("kindLexicon — R7 subject-kind gate (DeepSeek P1)", () => {
  it("head kinds: longest NP wins, sale cues skipped", () => {
    expect(adKindForTitle("ماشین لباسشویی پاکشوما")).toBe("appliance"); // not vehicle!
    expect(adKindForTitle("پراید ۱۳۱")).toBe("vehicle");
    expect(adKindForTitle("باطری ماشین")).toBe("vehicle-part");
    expect(adKindForTitle("فروش پراید")).toBe("vehicle"); // فروش skipped
    expect(adKindForTitle("کره بادام زمینی")).toBe("food-derived");
    expect(adKindForTitle("کرم بادوم زمینی")).toBe("food-derived"); // observed typo
    expect(adKindForTitle("آموزش تعمیرات موبایل")).toBe("training");
    expect(adKindForTitle("تعمیرات تخصصی موبایل")).toBe("service");
    expect(adKindForTitle("تابلو LED")).toBe("signage");
    expect(adKindForTitle("مبل راحتی")).toBe("furniture");
    expect(adKindForTitle("دستگاه جوجه کشی")).toBe("equipment");
    expect(adKindForTitle("پودر لباسشویی")).toBe("consumable");
    expect(adKindForTitle("قاب ایفون")).toBe("mobile-accessory");
    expect(adKindForTitle("آگهی عجیب غریب")).toBeNull(); // unknown → no gate
  });

  it("query kinds", () => {
    expect(queryKindForDef(["ماشین"], false, "vehicles")).toBe("vehicle");
    expect(queryKindForDef(["ماشین", "لباسشویی"], false, "")).toBe("appliance");
    expect(queryKindForDef(["باطری", "ماشین"], false, "")).toBe("vehicle-part");
    expect(queryKindForDef(["کره", "بادوم", "زمینی"], false, "")).toBe("food-derived");
    expect(queryKindForDef(["تعمیر", "یخچال"], true, "")).toBe("service");
    // Explicit training subject beats the service-intent fallback.
    expect(queryKindForDef(["آموزش", "تعمیرات", "موبایل"], true, "")).toBe("training");
    expect(queryKindForDef(["بادوم", "زمینی"], false, "")).toBe("food");
    expect(queryKindForDef(["چیز", "عجیب"], false, "")).toBeNull();
  });

  it("gate: mismatches reject, unknowns never gate", () => {
    // h1: signboard on a service hunt
    expect(kindGateRejects("service", "signage")).toMatch(/^kind:/);
    // part on an item hunt
    expect(kindGateRejects("vehicle", "vehicle-part")).toMatch(/^kind:/);
    // symmetric بادوم rule: neither direction leaks
    expect(kindGateRejects("food", "food-derived")).toMatch(/^kind:/);
    expect(kindGateRejects("food-derived", "food")).toMatch(/^kind:/);
    // consumable on an appliance hunt
    expect(kindGateRejects("appliance", "consumable")).toMatch(/^kind:/);
    // same kind passes
    expect(kindGateRejects("vehicle", "vehicle")).toBeNull();
    expect(kindGateRejects("food-derived", "food-derived")).toBeNull();
    // unknown on either side → no gate
    expect(kindGateRejects(null, "vehicle")).toBeNull();
    expect(kindGateRejects("vehicle", null)).toBeNull();
    expect(kindGateRejects(null, null)).toBeNull();
  });

  it("service hunts: target kind is compatible (S3 demote, not reject)", () => {
    expect(targetKindForDef(["تعمیر", "یخچال"])).toBe("appliance");
    expect(targetKindForDef(["تعمیرات", "تخصصی", "موبایل"])).toBe("mobile");
    // target goods pass the gate…
    expect(kindGateRejects("service", "appliance", "appliance")).toBeNull();
    // …but truly unrelated kinds are still rejected
    expect(kindGateRejects("service", "signage", "mobile")).toMatch(/^kind:/);
  });
});
