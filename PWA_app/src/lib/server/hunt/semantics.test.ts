import { describe, expect, it } from "vitest";

import {
  assessListingRole,
  assessModelSpecificity,
  assessQueryIntent,
  assessRepairPolarity,
  assessRepairService,
  assessServiceTarget,
  exclusionFires,
  isRepairWord,
  rolesClash,
} from "./semantics";

describe("assessListingRole", () => {
  it("detects a service offer without confusing it with a product", () => {
    expect(assessListingRole("تعمیر یخچال در محل").role).toBe("service");
    expect(assessListingRole("تعمیرات موبایل سامسونگ").role).toBe("service");
    expect(assessListingRole("یخچال ساید سالم فروش فوری").role).toBe("product");
  });

  it("does not classify repair history as a service offer", () => {
    // Attribute phrasing («تعمیر شده» / «بدون تعمیر») is polarity evidence,
    // never service-offer evidence.
    expect(assessListingRole("یخچال تعمیر شده سالم").role).not.toBe("service");
    expect(assessListingRole("آیفون ۱۳ بدون تعمیر").role).not.toBe("service");
  });

  it("detects buyer-seeking subjects but not mid-text mentions", () => {
    expect(assessListingRole("خریدار یخچال سالم خراب سوخته").role).toBe("buyer-seeking");
    expect(assessListingRole("خواهان آپارتمان نوساز").role).toBe("buyer-seeking");
    // «فروش به خریدار واقعی» sells TO a buyer — it is a product listing.
    expect(assessListingRole("فروش یخچال به خریدار واقعی").role).toBe("product");
  });

  it("detects rental and exchange cues", () => {
    expect(assessListingRole("اجاره آپارتمان سعادت آباد").role).toBe("rental");
    expect(assessListingRole("فروش عمده گوشی همکار").role).toBe("exchange");
  });

  it("stays unknown when no role cue is confident", () => {
    expect(assessListingRole("یخچال ساید سالم").role).toBe("unknown");
    expect(assessListingRole("   ").role).toBe("unknown");
  });
});

describe("assessQueryIntent", () => {
  it("reads service and buyer intent from the query text", () => {
    expect(assessQueryIntent("تعمیر یخچال", "all", "").role).toBe("service");
    expect(assessQueryIntent("خریدار یخچال", "all", "").role).toBe("buyer-seeking");
  });

  it("implies product intent only with a clear category", () => {
    expect(assessQueryIntent("یخچال", "home", "").role).toBe("product");
    expect(assessQueryIntent("یخچال", "all", "").role).toBe("unknown");
  });

  it("honors the explicit transaction answer", () => {
    expect(assessQueryIntent("آپارتمان", "real-estate", "rent").role).toBe("rental");
    expect(assessQueryIntent("آپارتمان", "all", "buy").role).toBe("product");
  });
});

describe("rolesClash", () => {
  const q = (role: "product" | "service" | "buyer-seeking" | "unknown") => ({
    role,
    reason: "test",
  });
  const l = (role: "product" | "service" | "buyer-seeking" | "rental" | "exchange" | "unknown") => ({
    role,
    reason: "test",
  });

  it("clashes product queries with service and buyer-seeking listings", () => {
    expect(rolesClash(q("product"), l("service"), false).clash).toBe(true);
    expect(rolesClash(q("product"), l("buyer-seeking"), false).clash).toBe(true);
    expect(rolesClash(q("product"), l("exchange"), false).clash).toBe(true);
  });

  it("never clashes on unknown or compatible roles", () => {
    expect(rolesClash(q("unknown"), l("service"), false).clash).toBe(false);
    expect(rolesClash(q("product"), l("unknown"), false).clash).toBe(false);
    expect(rolesClash(q("service"), l("service"), false).clash).toBe(false);
  });

  it("needs explicit buy intent before clashing product queries with rentals", () => {
    expect(rolesClash(q("product"), l("rental"), false).clash).toBe(false);
    expect(rolesClash(q("product"), l("rental"), true).clash).toBe(true);
  });
});

describe("assessModelSpecificity", () => {
  it("flags a sibling variant that extends the requested phrase", () => {
    const r = assessModelSpecificity(
      ["آیفون", "۱۳", "پرو"],
      "آیفون ۱۳ پرو مکس ۲۵۶ گیگ",
      "mobile"
    );
    expect(r.mismatch).toBe(true);
    expect(r.reason).toMatch("مکس");
  });

  it("keeps exact and family-compatible matches eligible", () => {
    expect(
      assessModelSpecificity(["آیفون", "۱۳", "پرو"], "آیفون ۱۳ پرو ۲۵۶ گیگ", "mobile")
        .mismatch
    ).toBe(false);
    // Broad query vs more specific listing: no marker beyond the query terms
    // («پرو» alone is family detail, not a sibling SKU marker).
    expect(
      assessModelSpecificity(["آیفون", "۱۳"], "آیفون ۱۳ پرو ۱۲۸ گیگ", "mobile").mismatch
    ).toBe(false);
  });

  it("does not fire on partial evidence or empty input", () => {
    expect(
      assessModelSpecificity(["آیفون", "۱۳", "پرو"], "آیفون ۱۳ معمولی", "mobile").mismatch
    ).toBe(false);
    expect(assessModelSpecificity([], "آیفون ۱۳ پرو مکس", "mobile").mismatch).toBe(false);
  });
});

describe("assessRepairPolarity", () => {
  it("recognizes absent markers across common phrasings", () => {
    expect(assessRepairPolarity("آیفون ۱۳ بدون تعمیر").polarity).toBe("absent");
    expect(assessRepairPolarity("گوشی بدون هیچ تعمیری").polarity).toBe("absent");
    expect(assessRepairPolarity("موبایل تعمیر نشده").polarity).toBe("absent");
  });

  it("recognizes present markers", () => {
    expect(assessRepairPolarity("آیفون ۱۳ تعمیر شده").polarity).toBe("present");
    expect(assessRepairPolarity("گوشی تعمیری").polarity).toBe("present");
  });

  it("treats bare mentions and conflicts as unknown", () => {
    // The word alone proves nothing about history or service.
    expect(assessRepairPolarity("سابقه تعمیر نامشخص").polarity).toBe("unknown");
    expect(assessRepairPolarity("بدون تعمیر ولی تعمیر شده؟").polarity).toBe("unknown");
  });
});

describe("exclusionFires", () => {
  it("fires repair bans only on explicitly present history", () => {
    expect(isRepairWord("تعمیر")).toBe(true);
    expect(isRepairWord("دیجیتال")).toBe(false);
    expect(exclusionFires("آیفون ۱۳ بدون تعمیر", "تعمیر", "mobile")).toBe(false);
    expect(exclusionFires("آیفون ۱۳ تعمیر شده", "تعمیر", "mobile")).toBe(true);
    expect(exclusionFires("آیفون ۱۳ سالم", "تعمیر", "mobile")).toBe(false);
  });

  it("never treats a bare or ambiguous mention as repair evidence", () => {
    // Unknown polarity must not reject: the candidate is preserved and the
    // verdict stage caps it at near instead.
    expect(exclusionFires("آیفون ۱۳، سابقه تعمیر مشخص نیست", "تعمیر", "mobile")).toBe(
      false
    );
    expect(exclusionFires("بدون تعمیر ولی تعمیر شده؟", "تعمیر", "mobile")).toBe(false);
  });

  it("preserves generic exclusions", () => {
    expect(exclusionFires("پیانو دیجیتال", "دیجیتال", "music")).toBe(true);
    expect(exclusionFires("پیانو آکوستیک", "دیجیتال", "music")).toBe(false);
  });
});

describe("assessRepairService", () => {
  it("recognizes explicit service offers", () => {
    expect(assessRepairService("تعمیرکار یخچال در محل").signal).toBe("service_offered");
    expect(assessRepairService("خدمات تعمیر یخچال").signal).toBe("service_offered");
    expect(assessRepairService("تعمیر یخچال شما را انجام میدهیم").signal).toBe(
      "service_offered"
    );
  });

  it("recognizes items needing repair as condition, not offers", () => {
    expect(assessRepairService("یخچال فریزر دوو-نیاز به تعمیر دارد").signal).toBe(
      "item_needs_repair"
    );
    expect(assessRepairService("موتورش باید تعمیر شود").signal).toBe("item_needs_repair");
    expect(assessRepairService("خراب است و تعمیر لازم دارد").signal).toBe(
      "item_needs_repair"
    );
    expect(assessRepairService("نیازمند تعمیر است").signal).toBe("item_needs_repair");
  });

  it("does not read good condition as damage", () => {
    expect(assessRepairService("یخچال سالم بدون نیاز به تعمیر").signal).toBe(
      "unknown_or_mixed"
    );
  });

  it("treats bare mentions and mixed evidence as uncertain", () => {
    expect(assessRepairService("تعمیر یخچال").signal).toBe("unknown_or_mixed");
    expect(assessRepairService("یخچال سالم").signal).toBe("unknown_or_mixed");
    expect(
      assessRepairService("تعمیرکار یخچال، نیاز به تعمیر دارید؟ تماس بگیرید").signal
    ).toBe("unknown_or_mixed");
  });
});

describe("assessServiceTarget", () => {
  it("binds an explicitly targeted offer", () => {
    expect(
      assessServiceTarget(["تعمیر", "یخچال"], "تعمیر یخچال در محل", "home").bound
    ).toBe(true);
    expect(
      assessServiceTarget(
        ["تعمیر", "یخچال"],
        "تعمیر یخچال و لباسشویی در محل",
        "home"
      ).bound
    ).toBe(true);
  });

  it("does not bind incidental far-away mentions", () => {
    expect(
      assessServiceTarget(
        ["تعمیر", "یخچال"],
        "تعمیر لباسشویی در محل با ضمانت یکساله، یخچال فریزر هم موجود است",
        "home"
      ).bound
    ).toBe(false);
  });

  it("does not bind across clauses or through polarity spans", () => {
    expect(
      assessServiceTarget(
        ["تعمیر", "یخچال"],
        "تعمیرات تخصصی لوازم خانگی در سراسر تهران با ضمانت، یخچال و لباسشویی پذیرفته میشود",
        "home"
      ).bound
    ).toBe(false);
    expect(assessServiceTarget(["تعمیر", "یخچال"], "یخچال بدون تعمیر", "home").bound).toBe(
      false
    );
  });

  it("binds vacuously without target terms and through aliases", () => {
    expect(assessServiceTarget(["تعمیر"], "تعمیر در محل", "mobile").bound).toBe(true);
    expect(
      assessServiceTarget(["تعمیر", "موبایل"], "تعمیر گوشی در محل", "mobile").bound
    ).toBe(true);
  });
});
