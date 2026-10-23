import { describe, expect, it } from "vitest";
import {
  assessAbsencePolarity,
  assessBaitTitle,
  assessDemandGoods,
  assessEntityComplement,
  assessListingRole,
  assessQueryIntent,
  assessModelSpecificity,
  floorMatFlatbedConflict,
} from "./semantics";
import { queryKindForDef } from "./kindLexicon";

/**
 * R8 regression tests (2026-10-19) — from the DeepSeek red-team review
 * (Freebuff session) of the author's 7 diagnoses. Each test pins a
 * verified wound: the exact query/ad shape, the expected verdict.
 */
describe("E3 — buyer cue must not overrule seller description copy", () => {
  it("does not label a product as buyer-seeking for a mid-description «به دنبال»", () => {
    const role = assessListingRole(
      "پیانو اصلی بتهوون اصلی؛ این پیانو برای خانواده‌هایی که به دنبال یک پیانو با کیفیت و سالم برای استفاده موسیقی هستند مناسب است"
    );
    expect(role.role).not.toBe("buyer-seeking");
  });

  it("keeps a leading «به دنبال» declaration as buyer-seeking", () => {
    expect(assessListingRole("به دنبال خرید پیانو هستم").role).toBe("buyer-seeking");
  });
});

describe("R9 — styled sibling variants", () => {
  const qk = (inc: string[]) => queryKindForDef(inc, false, "music");

  it("«طرح آکوستیک» is a near-miss for a real acoustic-piano hunt", () => {
    const r = assessModelSpecificity(
      ["پیانو", "اکوستیک"],
      "پیانو دیجیتال یاماها طرح آکوستیک",
      "music",
      qk(["پیانو", "اکوستیک"]),
      "پیانو اکوستیک"
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
    expect(r.reason).toContain("style-prefix");
  });

  it("a clean acoustic piano remains eligible for exact", () => {
    const r = assessModelSpecificity(
      ["پیانو", "اکوستیک"],
      "پیانو آکوستیک کاوایی",
      "music",
      qk(["پیانو", "اکوستیک"]),
      "پیانو اکوستیک"
    );
    expect(r.mismatch).toBe(false);
  });

  it("a user who explicitly asks for a styled acoustic piano can still match it", () => {
    const include = ["پیانو", "اکوستیک"];
    const r = assessModelSpecificity(
      include,
      "پیانو طرح آکوستیک",
      "music",
      qk(include),
      "پیانو طرح اکوستیک",
      "پیانو طرح آکوستیک"
    );
    expect(r.mismatch).toBe(false);
  });

  it("a description-only mention cannot override a clean advertised title", () => {
    const include = ["پیانو", "اکوستیک"];
    const r = assessModelSpecificity(
      include,
      "پیانو آکوستیک کاوایی — در مقایسه با پیانوهای طرح آکوستیک",
      "music",
      qk(include),
      "پیانو اکوستیک",
      "پیانو آکوستیک کاوایی"
    );
    expect(r.mismatch).toBe(false);
  });
});

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
  it("R8c: model number after any descriptor is not bait (digit gate)", () => {
    // No allowlist — ANY descriptor before a model NUMBER shields, because
    // the number confirms same-item. فول/اتومات would have died on a list.
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید سالم ۱۳۱", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید فول ۱۳۱", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
    expect(
      assessBaitTitle("پراید ۱۳۱ مدل ۹۸", "پراید اتومات ۱۳۱", ["پراید", "۱۳۱", "مدل", "۹۸"])
    ).toBe(false);
  });
  it("R8c: word (non-model) at hi+2 is still bait — incl. padding", () => {
    expect(
      assessBaitTitle(
        "موتور سیکلت هوندا",
        "موتور برق سیکلت",
        ["موتور", "سیکلت", "هوندا"],
        "موتور سیکلت هوندا"
      )
    ).toBe(true);
    // Padding loophole closed: a descriptor before a WORD modifier
    // doesn't shield («موتور سالم سیکلت برق»).
    expect(
      assessBaitTitle(
        "موتور سیکلت هوندا",
        "موتور سالم سیکلت برق ۳ کیلووات",
        ["موتور", "سیکلت", "هوندا"],
        "موتور سیکلت هوندا"
      )
    ).toBe(true);
  });
  it("R8c: city-first query keeps head on the item (R-C)", () => {
    // query «تهران موتور سیکلت»: تهران is not in the hunt definition,
    // so the head is موتور, not تهران.
    expect(
      assessBaitTitle(
        "موتور سیکلت",
        "موتور برق ۳ کیلووات",
        ["موتور", "سیکلت"],
        "تهران موتور سیکلت"
      )
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
  it("genuine bait still fires (rule not neutered)", () => {
    expect(
      assessBaitTitle("موتور سیکلت", "موتور برق ۳/۵ کیلووات", ["موتور", "سیکلت"])
    ).toBe(true);
    expect(
      assessBaitTitle("موتور سیکلت", "موتور سالم برق ۳ کیلووات", ["موتور", "سیکلت"])
    ).toBe(true);
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
  it("R8c: lead must be positively goods-led (R-D)", () => {
    // Shop ad: price in the lead + borrowed service → fires.
    expect(assessDemandGoods(inc, "کولر گازی ۱۸۰۰۰ - نصب و تعمیر")).toBe(true);
    // Installer: bare product name + service → clean.
    expect(assessDemandGoods(inc, "کولر گازی - نصب و تعمیر")).toBe(false);
    // Comma installer: no goods signal in the lead → clean.
    expect(assessDemandGoods(inc, "کولر گازی، نصب و تعمیر")).toBe(false);
    // Comma goods ad: price in the lead → fires.
    expect(assessDemandGoods(inc, "کولر گازی ۱۸۰۰۰، نصب و تعمیر")).toBe(true);
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


describe("E3 — floor-mat intent rejects trailer/flatbed listings only in that query", () => {
  const floorMatQuery = "کفی ماشین";

  it("keeps human-graded floor-mat positives eligible", () => {
    expect(
      floorMatFlatbedConflict(
        floorMatQuery,
        "لاستیک و کف پوش ماشین",
        "کف پوش سه بعدی جنس عالی قیمت توافقی"
      )
    ).toBeNull();
    expect(
      floorMatFlatbedConflict(
        floorMatQuery,
        "کفی سه بعدی نمدی فابریکی اطلس",
        "کفی سه بعدی نمدی فابریک اطلس نو استفاده نشده"
      )
    ).toBeNull();
    expect(
      floorMatFlatbedConflict(
        floorMatQuery,
        "کفی لاستیکی خودرو",
        "دوجفت کفی لاستیکی خودرو تمیز"
      )
    ).toBeNull();
    // Human-reviewed ambiguous phrase: do not hard-reject without enough context.
    expect(
      floorMatFlatbedConflict(
        floorMatQuery,
        "کفی مبلی نیسانی",
        "کفی مبلی مخصوص نیسان دوگانه دستی"
      )
    ).toBeNull();
  });

  it("flags source-matched flatbed/trailer families for the floor-mat query", () => {
    const cases = [
      ["کفی تریلر", "سلام تریلی چرخ 24"],
      ["کفی تریلی ۲محور رول کش بالونی ۱۲/۶۰", "تیغه مبارکه سالم بدون شکستگی"],
      ["کفی ایران کاوه", "کفی ایران کاوه مدل 71 سری اول شرکت ایران کاوه"],
      ["کفی مارال ۱۳/۷۰", "کفی مارال لاستیک ۶۰درصد آماده کار"],
      ["آریسان ۲ با کفی و باربند", "دوگانه سوز ۴۰۳ با کفی و باربند روکش صندلی"],
      ["فروش جرثقیل ۱۰ تن کفی اطلس سالم", "جرثقیل ۱۰ تن کفی دستگاه اطلس مدل ۵۵ سالم"],
      ["کفی ماشین باری باربندخاص", "از از جنس ضعیف تا جنس یک بازار فقط ازما بخواهید"],
      ["مانیتور قسطی ماشین خودرو سمند سورن سیستم کفی روکش", "مرکز مانیتور عبدی صوت تصویر"],
      ["مانیتور هدلایت سیستم کفی روکش ماشین خودرو جیلی", "مرکز صوت تصویر"],
    ] as const;
    for (const [title, description] of cases) {
      expect(floorMatFlatbedConflict(floorMatQuery, title, description)).not.toBeNull();
    }
  });

  it("does not apply to explicit trailer intent or unrelated queries", () => {
    expect(
      floorMatFlatbedConflict("کفی تریلی", "کفی تریلی", "سه محور رول کش")
    ).toBeNull();
    expect(
      floorMatFlatbedConflict("کفی ماشین", "کفی لاستیکی خودرو", "دو جفت کفی تمیز")
    ).toBeNull();
    expect(
      floorMatFlatbedConflict("ماشین بدون رنگ", "کفی تریلی", "تریلی سه محور")
    ).toBeNull();
  });
});


describe("E3 — explicit exchange query outranks generic buy transaction", () => {
  it("keeps an explicit exchange hunt as exchange even when transaction defaults to buy", () => {
    expect(
      assessQueryIntent("معاوضه با کفی سه محور", "vehicles", "buy")
    ).toEqual({ role: "exchange", reason: 'query-exchange-cue:"معاوضه"' });
  });

  it("does not promote replacement history to exchange intent", () => {
    expect(
      assessQueryIntent("پیانو اکوستیک قطعات تعویض شده", "music", "buy")
    ).toEqual({ role: "product", reason: "transaction:buy" });
  });

  it("keeps ordinary explicit buy transaction behavior unchanged", () => {
    expect(assessQueryIntent("پیانو اکوستیک", "music", "buy")).toEqual({
      role: "product",
      reason: "transaction:buy",
    });
  });
});

describe("E3 — negated replacement history is not an exchange offer", () => {
  it("does not classify a negated repair-history query as a service hunt", () => {
    expect(assessListingRole("پیانو تعمیر یا تعویض نشده است").role).toBe("unknown");
    expect(assessQueryIntent("پیانو تعمیر یا تعویض نشده است", "music", "")).toEqual({
      role: "product",
      reason: "implied-product:clear-category",
    });
  });

  it("does not read «تعمیر یا تعویض نشده است» as an exchange role", () => {
    const r = assessListingRole(
      "فروشگاه پیانو فروش مرجع تخصصی خرید و فروش ادوات موسیقی؛ قطعات کاملا اورجینال هستش تعمیر یا تعویض نشده است"
    );
    expect(r.role).toBe("product");
  });

  it("does not read «بدون تعویض» as an exchange offer", () => {
    const r = assessListingRole("فروش پیانو اکوستیک، قطعات اصلی و بدون تعویض");
    expect(r.role).toBe("product");
  });

  it("handles common negated replacement-history variants without inventing an exchange offer", () => {
    const descriptions = [
      "پیانو اکوستیک تعویض نشده",
      "پیانو اکوستیک قطعات تعویض نشد",
      "پیانو اکوستیک تعویض ندارد",
      "پیانو اکوستیک تعویض نداشته است",
      "پیانو اکوستیک فاقد تعویض",
      "پیانو اکوستیک تعویض نمی شود",
    ];
    for (const description of descriptions) {
      // Negated history must not invent an exchange role; without a positive
      // sale cue the correct role may remain unknown rather than product.
      expect(assessListingRole(description).role, description).not.toBe("exchange");
    }
  });

  it("preserves positive exchange wording in more than one form", () => {
    for (const description of [
      "پیانو اکوستیک معاوضه با پیانو دیجیتال",
      "پیانو اکوستیک را با کالای دیگر تعویض می‌کنم",
    ]) {
      expect(assessListingRole(description).role, description).toBe("exchange");
    }
  });

  it("keeps a source-captured real exchange offer classified as exchange", () => {
    // Live observation artifact engine-v3-live-observation-25,
    // sourceAdId gaZj__jh; title: «تریلی بیات معاوضه با کفی سه محور».
    expect(assessListingRole("تریلی بیات معاوضه با کفی سه محور").role).toBe("exchange");
  });

  it("does not let a negated history clause hide a separate positive exchange offer", () => {
    const r = assessListingRole(
      "پیانو اکوستیک؛ قطعات تعویض نشده است؛ معاوضه با پیانو دیجیتال"
    );
    expect(r.role).toBe("exchange");
  });
});


describe("E3 follow-up — part replacement is not exchange intent", () => {
  it("does not classify a repair service's «تعویض قطعات معیوب» as an exchange offer", () => {
    for (const description of [
      "آکادمی بین المللی فنی پیانو آموزش کوک پیانو تعمیر پیانو تعویض قطعات معیوب",
      "پیانو آکوستیک یادگیری کوک و تعمیر پیانو تعویض قطعات معیوب",
    ]) {
      expect(assessListingRole(description).role, description).not.toBe("exchange");
    }
  });

  it("preserves an independent explicit exchange offer beside part-replacement wording", () => {
    expect(
      assessListingRole("تعمیر پیانو تعویض قطعات معیوب؛ معاوضه با پیانو دیجیتال").role
    ).toBe("exchange");
  });
});

describe("E3 follow-up — replacement history is not exchange intent", () => {
  it("does not classify «قطعات تعویض شده» as an exchange offer", () => {
    expect(assessListingRole("قطعات تعویض شده").role).not.toBe("exchange");
    expect(assessListingRole("پیانو اکوستیک، قطعات تعویض شده").role).not.toBe("exchange");
  });

  it("preserves an explicit exchange offer beside replacement-history wording", () => {
    expect(
      assessListingRole("قطعات تعویض شده؛ معاوضه با پیانو دیجیتال").role
    ).toBe("exchange");
  });
});

describe("E3 — replacement-history polarity contract", () => {
  it("explicitly negated replacement history satisfies the absence constraint", () => {
    expect(
      assessAbsencePolarity("پیانو قطعات تعویض نشده است", "تعویض").polarity
    ).toBe("absent");
  });

  it("explicitly positive replacement history contradicts the absence constraint", () => {
    expect(
      assessAbsencePolarity("پیانو قطعات تعویض شده است", "تعویض").polarity
    ).toBe("present");
  });

  it("bare «بدون دستکاری» does not by itself prove replacement history absent", () => {
    expect(
      assessAbsencePolarity("پیانو اصلی بتهوون؛ بدون دستکاری", "تعویض").polarity
    ).toBe("unknown");
  });
});

