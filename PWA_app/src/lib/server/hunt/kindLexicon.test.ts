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
    expect(kindGateRejects("service", "signage")?.reason).toMatch(/^kind:/);
    expect(kindGateRejects("service", "signage")?.tier).toBe("reject");
    // part on an item hunt
    expect(kindGateRejects("vehicle", "vehicle-part")?.reason).toMatch(/^kind:/);
    // symmetric بادوم rule: neither direction leaks
    expect(kindGateRejects("food", "food-derived")?.reason).toMatch(/^kind:/);
    expect(kindGateRejects("food-derived", "food")?.reason).toMatch(/^kind:/);
    // consumable on an appliance hunt
    expect(kindGateRejects("appliance", "consumable")?.reason).toMatch(/^kind:/);
    // same kind passes
    expect(kindGateRejects("vehicle", "vehicle")).toBeNull();
    expect(kindGateRejects("food-derived", "food-derived")).toBeNull();
    // unknown on either side → no gate
    expect(kindGateRejects(null, "vehicle")).toBeNull();
    expect(kindGateRejects("vehicle", null)).toBeNull();
    expect(kindGateRejects(null, null)).toBeNull();
  });

  it("R8 F4a: service ad on a goods hunt demotes, never rejects", () => {
    const v = kindGateRejects("vehicle-part", "service");
    expect(v?.tier).toBe("demote");
    expect(v?.reason).toMatch(/^kind:demote:/);
    // service-on-service still passes (unchanged)
    expect(kindGateRejects("service", "service")).toBeNull();
  });

  it("R8b: خدمات is the most common service head (F4a gap)", () => {
    expect(adKindForTitle("خدمات باطری ماشین")).toBe("service");
    const v = kindGateRejects("vehicle-part", "service");
    expect(v?.tier).toBe("demote");
  });

  it("R8c: «خدمات پس از فروش» is a goods phrase, not a service head (R-E)", () => {
    expect(adKindForTitle("خدمات پس از فروش یخچال سامسونگ")).toBeNull();
    expect(adKindForTitle("خدمات باطری ماشین")).toBe("service");
  });

  it("R8 F4b: ماشین/موتور + unknown modifier → null, bare → vehicle", () => {
    expect(adKindForTitle("ماشین جوجه کشی")).toBeNull();
    expect(adKindForTitle("موتور برق")).toBeNull();
    expect(adKindForTitle("ماشین")).toBe("vehicle");
    expect(adKindForTitle("موتور")).toBe("vehicle");
    // known two-token compounds still win
    expect(adKindForTitle("ماشین لباسشویی")).toBe("appliance");
    expect(adKindForTitle("موتور سیکلت")).toBe("vehicle");
  });

  it("R8 F4c: ی-dropped spellings find the lexicon via stemmed fallback", () => {
    expect(adKindForTitle("ماشین لباسشوی ۱۰ کیلویی ال جی")).toBe("appliance");
    // raw behavior preserved everywhere else
    expect(adKindForTitle("امداد باطری ماشین")).toBe("service");
    expect(adKindForTitle("پراید ۱۳۱")).toBe("vehicle");
  });

  it("service hunts: target kind is compatible (S3 demote, not reject)", () => {
    expect(targetKindForDef(["تعمیر", "یخچال"])).toBe("appliance");
    expect(targetKindForDef(["تعمیرات", "تخصصی", "موبایل"])).toBe("mobile");
    // target goods pass the gate…
    expect(kindGateRejects("service", "appliance", "appliance")).toBeNull();
    // …but truly unrelated kinds are still rejected
    expect(kindGateRejects("service", "signage", "mobile")?.reason).toMatch(/^kind:/);
  });
});

describe("kindLexicon — R7-redteam fixes (2026-10-18)", () => {
  it("home heads resolve (no more home-goods↔furniture mass-reject)", () => {
    expect(adKindForTitle("میز غذاخوری چوبی")).toBe("furniture");
    expect(adKindForTitle("تخت خواب دو نفره")).toBe("furniture");
    expect(adKindForTitle("کمد لباس")).toBe("furniture");
    expect(adKindForTitle("سرویس خواب")).toBe("furniture"); // not service!
    expect(adKindForTitle("صندلی ماشین کودک")).toBe("vehicle-part"); // longest wins
    expect(adKindForTitle("لوستر پذیرایی")).toBe("home-goods");
  });

  it("ZWNJ-joined heads read through normalization", () => {
    expect(adKindForTitle("ماشین‌لباسشویی سامسونگ")).toBe("appliance");
  });

  it("serviceHunt gate: service ads pass on item-first service queries", () => {
    // «یخچال تعمیر»: queryKind appliance (lexicon-first), serviceHunt true.
    expect(kindGateRejects("appliance", "service", "appliance", true)).toBeNull();
    // target goods pass (S3 demote, not reject)…
    expect(kindGateRejects("appliance", "appliance", "appliance", true)).toBeNull();
    // …truly unrelated kinds still reject, compared against the TARGET.
    expect(kindGateRejects("appliance", "furniture", "appliance", true)?.reason).toMatch(/^kind:/);
    expect(kindGateRejects("appliance", "signage", "appliance", true)?.reason).toMatch(/^kind:/);
  });
});


describe("Issue 16 — Capture 05F title-head characterization (evidence-only)", () => {
  it("keeps a known whole-vehicle head classifiable", () => {
    expect(adKindForTitle("فروش پراید")).toBe("vehicle");
  });

  it("documents the current unknown-head gap on source-matched 05F rows", () => {
    // These are characterization assertions, not the desired final behavior:
    // the kind gate deliberately no-ops on unknown heads. The paired fix must
    // classify principal item kind without breaking whole-vehicle buyer/dealer
    // positives or treating later model mentions as the principal item.
    expect(adKindForTitle("خرید فروش انواع کاتالیزور خارجی ایران فرسوده")).toBeNull(); // B01
    expect(adKindForTitle("کارشناسی وقیمت گذاری خودرو تصادفی /وخریدار تصادفی")).toBeNull(); // B02: whole-vehicle positive; role ≠ kind
    expect(adKindForTitle("بدنه کاپوت گلگیر سپر چراغ قیمت عمده")).toBeNull(); // B03
    expect(adKindForTitle("فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند")).toBeNull(); // B04: later vehicle names
    expect(adKindForTitle("کاتالیزور o. تعمیر. o خرید خاک و منبع")).toBeNull(); // B05
    expect(adKindForTitle("لاستیک تیبا 95درصد معاوضه با پراید")).toBeNull(); // B06: already rejected by full pipeline
    expect(adKindForTitle("فردا موتور FMC511/صفر و خشک برج روز/نمایندگی")).toBeNull(); // B07: whole-vehicle dealer positive
  });

  it("shows why the vehicle-category fallback alone cannot close unknown ad heads", () => {
    const queryKind = queryKindForDef(["خرید", "فروش", "خودرو"], false, "vehicles");
    expect(queryKind).toBe("vehicle");
    expect(kindGateRejects(queryKind, adKindForTitle("بدنه کاپوت گلگیر سپر چراغ قیمت عمده"))).toBeNull();
    expect(kindGateRejects(queryKind, adKindForTitle("خرید فروش انواع کاتالیزور خارجی ایران فرسوده"))).toBeNull();
  });
});

describe("Issue 16 — Capture 05F supplement 02 title-head characterization (evidence-only)", () => {
  it("records current item-head parsing for the seven newly graded source titles", () => {
    // These assertions freeze observed behavior for the paired evaluation;
    // they do not assert that the current outcomes are desirable.
    expect(adKindForTitle("فروش موتور کامل پژو پراید نیسان سمند تیبا xu7 tu5")).toBeNull(); // S01, engine/components
    expect(adKindForTitle("فروش فوری دنا پلاس توربو اتومات")).toBe("vehicle"); // S02, whole-vehicle sale
    expect(adKindForTitle("تعمیر تخصصی کاتالیزور با ضمانت 1ساله")).toBe("service"); // S03, catalyst service
    expect(adKindForTitle("خرید فروش کاتالیزور")).toBeNull(); // S04, transaction prefix blocks head parse
    expect(adKindForTitle("فروش سپر جلوپنجره چراغ پراید پژو سمند ساینا کوئیک")).toBeNull(); // S05, parts; later vehicle names
    expect(adKindForTitle("پارس1400 معاوضه (خریدار)خودرو تصادفی وچپیوکاردار")).toBeNull(); // S06, damaged whole-vehicle buyer
    expect(adKindForTitle("فروش خرید انواع کاتالیزور خارجی ایران فرسوده")).toBeNull(); // S07, catalyst buying/selling
  });

  it("shows that unknown heads make the vehicle-category kind gate a no-op", () => {
    const queryKind = queryKindForDef(["خرید", "و", "فروش", "خودرو"], false, "vehicles");
    expect(queryKind).toBe("vehicle");
    for (const title of [
      "فروش موتور کامل پژو پراید نیسان سمند تیبا xu7 tu5",
      "خرید فروش کاتالیزور",
      "فروش سپر جلوپنجره چراغ پراید پژو سمند ساینا کوئیک",
      "پارس1400 معاوضه (خریدار)خودرو تصادفی وچپیوکاردار",
      "فروش خرید انواع کاتالیزور خارجی ایران فرسوده",
    ]) {
      expect(kindGateRejects(queryKind, adKindForTitle(title))).toBeNull();
    }
    // Known direct whole-vehicle title is classifiable and remains compatible.
    expect(kindGateRejects(queryKind, adKindForTitle("فروش فوری دنا پلاس توربو اتومات"))).toBeNull();
  });
});
