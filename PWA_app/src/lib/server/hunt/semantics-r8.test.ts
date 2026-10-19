import { describe, expect, it } from "vitest";
import {
  assessAbsencePolarity,
  assessBaitTitle,
  assessDemandGoods,
  assessEntityComplement,
  assessListingRole,
  assessModelSpecificity,
} from "./semantics";
import { queryKindForDef } from "./kindLexicon";

/**
 * R8 regression tests (2026-10-19) — from the DeepSeek red-team review
 * (Freebuff session) of the author's 7 diagnoses. Each test pins a
 * verified wound: the exact query/ad shape, the expected verdict.
 */
describe("R8 — F2 kind-aware marker guard (both passes)", () => {
  const qk = (inc: string[]) => queryKindForDef(inc, false, "all");
  it("دوره on a training hunt is the item, not a wrong item", () => {
    const r = assessModelSpecificity(
      ["آموزش", "تعمیرات", "موبایل"],
      "دوره آموزش تعمیرات موبایل",
      "all",
      qk(["آموزش", "تعمیرات", "موبایل"])
    );
    expect(r.mismatch).toBe(false);
  });
  it("کلاس on a training hunt is the item (new live case)", () => {
    const r = assessModelSpecificity(
      ["آموزش", "تعمیرات", "موبایل"],
      "کلاس آموزش تعمیرات موبایل",
      "all",
      qk(["آموزش", "تعمیرات", "موبایل"])
    );
    expect(r.mismatch).toBe(false);
  });
  it("مایع و پودر on a consumable hunt → exact, not near", () => {
    const r = assessModelSpecificity(
      ["پودر", "لباسشویی"],
      "مایع و پودر لباسشویی",
      "all",
      qk(["پودر", "لباسشویی"])
    );
    expect(r.mismatch).toBe(false);
  });
  it("R6 survival: گارد on a mobile hunt still rejects", () => {
    const r = assessModelSpecificity(
      ["آیفون", "۱۳", "پرو"],
      "گارد آیفون ۱۳ پرو",
      "all",
      qk(["آیفون", "۱۳", "پرو"])
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
  });
});

describe("R8 — F3 bait rule (phrase head/mod + query-token guard)", () => {
  it("phrase-include perfect ad is not bait (P2)", () => {
    expect(
      assessBaitTitle("موتور سیکلت هوندا", "موتور سیکلت ۱۲۵ مدل ۹۵", [
        "موتور سیکلت",
        "هوندا",
      ])
    ).toBe(false);
    expect(
      assessBaitTitle("کولر گازی ال جی", "کولر گازی ۱۸۰۰۰", ["کولر گازی", "ال جی"])
    ).toBe(false);
  });
  it("query-token modifier is confirmation, not bait", () => {
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید ۹۸ سالم", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
  });
  it("descriptor between head and modifier is not bait", () => {
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید سالم ۱۳۱", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
  });
  it("genuine bait still fires (rule not neutered)", () => {
    expect(
      assessBaitTitle("موتور سیکلت", "موتور برق ۳/۵ کیلووات", ["موتور", "سیکلت"])
    ).toBe(true);
    expect(
      assessBaitTitle("موتور سیکلت", "موتور سالم برق ۳ کیلووات", ["موتور", "سیکلت"])
    ).toBe(true);
  });
  it("R8b: head/mod from query text — chip order can't break it", () => {
    // include ["هوندا","موتور","سیکلت"] (chip prepended) with query text:
    expect(
      assessBaitTitle(
        "موتور سیکلت هوندا",
        "موتور برق ۳/۵ کیلووات بنزینی",
        ["هوندا", "موتور", "سیکلت"],
        "موتور سیکلت هوندا"
      )
    ).toBe(true);
  });
  it("R8b: stuffed bait escapes no more (descriptor-gated window)", () => {
    // 3-term shape: the description misses هوندا (guard passes), stuffs
    // سیکلت at hi+2 behind برق. برق is not a descriptor → still bait.
    expect(
      assessBaitTitle(
        "موتور سیکلت هوندا",
        "موتور برق سیکلت",
        ["موتور", "سیکلت", "هوندا"],
        "موتور سیکلت هوندا"
      )
    ).toBe(true);
    // ...but a real descriptor still shields («پراید سالم ۱۳۱»).
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید سالم ۱۳۱", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
  });
});

describe("R8 — F5 clause-based demand-goods rule", () => {
  const inc = ["نصاب", "کولر گازی"];
  it("R6 control still fires (parenthetical service borrowing)", () => {
    expect(assessDemandGoods(inc, "کولرگازی اصلی نو سالم (نصب امروز)")).toBe(true);
  });
  it("genuine installers do not fire (service-led clauses)", () => {
    expect(assessDemandGoods(inc, "خدمات فنی کولر گازی نصب و سرویس تعمیرات")).toBe(false);
    expect(assessDemandGoods(inc, "کانال کولر سازی و نصب و تعمیر کولر گازی")).toBe(false);
    expect(assessDemandGoods(inc, "نصب و تعمیر کولر گازی")).toBe(false);
  });
  it("R8b: dash/pipe are title separators, not clause boundaries (R2)", () => {
    expect(assessDemandGoods(inc, "کولر گازی - نصب و تعمیر")).toBe(false);
    expect(assessDemandGoods(inc, "کولر گازی | نصب و سرویس")).toBe(false);
  });
});

describe("R8 — F6 absence polarity (دارد/ندارد)", () => {
  it("وام ندارد confirms the بدون وام claim", () => {
    expect(assessAbsencePolarity("آپارتمان ۸۲ متری وام ندارد", "وام").polarity).toBe("absent");
    expect(assessAbsencePolarity("وام نداره", "وام").polarity).toBe("absent");
  });
  it("وام دارد defeats the بدون وام claim", () => {
    expect(assessAbsencePolarity("آپارتمان ۸۲ متری وام دارد", "وام").polarity).toBe("present");
    expect(assessAbsencePolarity("وام داره", "وام").polarity).toBe("present");
  });
});

describe.skip("R8 — P5 entity-as-complement (DISABLED 2026-10-19, R8b — see semantics.ts)", () => {
  it("associated entity as complement → reject", () => {
    expect(assessEntityComplement(["بادام", "زمینی"], "علف بادام زمینی").mismatch).toBe(true);
    expect(assessEntityComplement(["ماشین"], "سیستم ماشین").mismatch).toBe(true);
  });
  it("shop heads, known heads, entity heads → no fire", () => {
    expect(
      assessEntityComplement(["باطری", "ماشین"], "فروشگاه باطری سپاهان").mismatch
    ).toBe(false);
    expect(
      assessEntityComplement(["تعمیر", "موبایل"], "تعمیرات تخصصی موبایل").mismatch
    ).toBe(false);
    expect(assessEntityComplement(["پراید"], "پراید ۱۳۱").mismatch).toBe(false);
  });
});

describe("R8 — P6 glued variants + P7 word-boundary sale cues", () => {
  it("پرومکس is a sibling variant → near, not exact", () => {
    const r = assessModelSpecificity(["قاب", "آیفون", "۱۳"], "قاب آیفون ۱۳ پرومکس");
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
  });
  it("فروشگاه is not a sale cue", () => {
    expect(assessListingRole("فروشگاه باطری سپاهان").role).not.toBe("product");
    expect(assessListingRole("پراید ۱۳۱ فروش فوری").role).toBe("product");
  });
});
