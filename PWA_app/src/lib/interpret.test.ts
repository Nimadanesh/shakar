import { describe, expect, it } from "vitest";
import { interpretQuery } from "@/lib/interpret";

function kinds(raw: string): string[] {
  return interpretQuery(raw).applied.map((c) => `${c.kind}:${c.value}`);
}

function ids(raw: string): string[] {
  return interpretQuery(raw).applied.map((c) => c.id);
}

describe("interpretQuery", () => {
  it("interprets the canonical piano query without inventing precision", () => {
    const { applied, preferences } = interpretQuery(
      "پیانو اکوستیک یاماها میخوام، ترجیحاً U3، تهران باشه، زیر ۲۰۰ میلیون، طرح اکوستیک و دیجیتال نمیخوام."
    );
    expect(kinds).toBeDefined();
    expect(applied.map((c) => c.id)).toContain("city:tehran");
    expect(applied.map((c) => c.id)).toContain("priceMax:200000000");
    // Negation scope stays conservative: conjunction splits into short terms.
    const excludes = applied.filter((c) => c.kind === "exclude").map((c) => c.value);
    expect(excludes).toContain("دیجیتال");
    expect(excludes).toContain("طرح اکوستیک");
    // Preference is surfaced but never applied as a hard filter.
    expect(preferences.map((p) => p.value)).toContain("u3");
    expect(preferences.every((p) => p.applied === false)).toBe(true);
    expect(applied.every((c) => c.source === "inferred")).toBe(true);
  });

  it("keeps vague language vague", () => {
    const { applied, preferences } = interpretQuery("آیفون ۱۵ خوب");
    expect(applied).toEqual([]);
    expect(preferences).toEqual([]);
  });

  it("returns empty interpretation for blank input", () => {
    expect(interpretQuery("   ")).toEqual({
      version: "v1",
      applied: [],
      preferences: [],
    });
  });

  it("detects a price floor", () => {
    const { applied } = interpretQuery("آپارتمان بالای ۵ میلیارد تهران");
    expect(applied.map((c) => c.id)).toContain("priceMin:5000000000");
    expect(applied.map((c) => c.id)).toContain("city:tehran");
  });

  it("detects expanded cities and name variants", () => {
    expect(ids("آپارتمان در شیراز")).toContain("city:shiraz");
    expect(ids("خونه در اورمیه")).toContain("city:urmia");
    expect(ids("ویلا در بندر عباس")).toContain("city:bandar-abbas");
    expect(ids("سوئیت در خرم‌آباد")).toContain("city:khorramabad");
    expect(ids("مغازه در قم")).toContain("city:qom");
  });

  it("detects cities from the full Divar directory, not just the old 28 (incident 2026-10-09)", () => {
    // بناب was never in the hand-written list — users hacked it in as a
    // «باید» chip, which starves retrieval instead of scoping it.
    expect(ids("آپارتمان در بناب")).toContain("city:bonab");
  });

  it("does not match a city inside another word (word boundaries)", () => {
    // «درشت» contains «رشت» — must not infer Rasht.
    expect(ids("ماهی درشت")).not.toContain("city:rasht");
    expect(ids("ماهی درشت")).not.toContainEqual(
      expect.stringMatching(/^city:/)
    );
  });

  it("detects بدون as an absent-attribute, not a hard exclusion (R3)", () => {
    const { applied } = interpretQuery("مبل راحتی بدون لکه");
    expect(applied.map((c) => c.id)).toContain("exclude:absent:لکه");
  });

  it("detects trailing negation exclusion as a whole phrase", () => {
    const { applied } = interpretQuery("پیانو دیجیتال نمیخوام");
    expect(applied.map((c) => c.id)).toContain("exclude:پیانو دیجیتال");
  });

  it("marks preference cues as display-only", () => {
    const { applied, preferences } = interpretQuery("پراید ترجیحا مدل بالا");
    expect(applied).toEqual([]);
    expect(preferences).toHaveLength(1);
    expect(preferences[0].applied).toBe(false);
  });

  it("does not treat bare numbers as prices", () => {
    const { applied } = interpretQuery("پژو ۲۰۶");
    expect(applied).toEqual([]);
  });

  it("detects rent transaction from اجاره‌ای", () => {
    const { applied } = interpretQuery("خونه اجاره‌ای تهران");
    const tx = applied.find((c) => c.kind === "transaction");
    expect(tx?.value).toBe("rent");
    expect(tx?.display).toBe("اجاره");
  });

  it("detects buy transaction from فروش", () => {
    const { applied } = interpretQuery("آپارتمان فروشی سعادت‌آباد");
    expect(applied.find((c) => c.kind === "transaction")?.value).toBe("buy");
  });

  it("detects رهن as rent", () => {
    const { applied } = interpretQuery("آپارتمان رهن کامل");
    expect(applied.find((c) => c.kind === "transaction")?.value).toBe("rent");
  });

  it("leaves transaction absent when no transaction word is present", () => {
    const { applied } = interpretQuery("خونه ۵۰ متری تهران");
    expect(applied.some((c) => c.kind === "transaction")).toBe(false);
  });

  it("R4: «وام» infers buy — «آپارتمان بدون وام» wants a sale, not a rental", () => {
    const { applied } = interpretQuery("آپارتمان بدون وام");
    expect(applied.find((c) => c.kind === "transaction")?.value).toBe("buy");
  });

  it("R4: «وام ودیعه» stays rent — ودیعه wins over وام", () => {
    const { applied } = interpretQuery("آپارتمان وام ودیعه");
    expect(applied.find((c) => c.kind === "transaction")?.value).toBe("rent");
  });
});

describe("mentionsRealEstate", () => {
  it("spots real-estate mentions", async () => {
    const { mentionsRealEstate } = await import("@/lib/interpret");
    expect(mentionsRealEstate("خونه ۵۰ متری تهران")).toBe(true);
    expect(mentionsRealEstate("آپارتمان نوساز")).toBe(true);
    expect(mentionsRealEstate("ویلا شمال")).toBe(true);
  });

  it("rejects non-real-estate queries", async () => {
    const { mentionsRealEstate } = await import("@/lib/interpret");
    expect(mentionsRealEstate("پیانو آکوستیک")).toBe(false);
    expect(mentionsRealEstate("گوشی آیفون")).toBe(false);
  });

  it("never substring-matches: «زمین» inside «بادام زمینی» is not real estate (prod incident 2026-10-15)", async () => {
    const { mentionsRealEstate, detectCategoryFromText } = await import("@/lib/interpret");
    // The peanut hunt was misclassified as real estate (ملک) and returned
    // zero results — «زمینی» contains «زمین» as a substring.
    expect(mentionsRealEstate("بادام زمینی")).toBe(false);
    expect(mentionsRealEstate("بادام زمینی ایرانی دشت مغان")).toBe(false);
    expect(detectCategoryFromText("بادام زمینی")).not.toBe("real-estate");
    // ...but a real land query still classifies.
    expect(mentionsRealEstate("زمین کشاورزی")).toBe(true);
    expect(mentionsRealEstate("فروش زمین")).toBe(true);
  });

  it("keeps villa and penthouse surface forms (were substring stems)", async () => {
    const { mentionsRealEstate } = await import("@/lib/interpret");
    expect(mentionsRealEstate("ویلا شمال")).toBe(true);
    expect(mentionsRealEstate("ویلایی تهران")).toBe(true);
    expect(mentionsRealEstate("پنتهاوس زعفرانیه")).toBe(true);
  });
});

describe("detectTransaction", () => {
  it("returns null without transaction words", async () => {
    const { detectTransaction } = await import("@/lib/interpret");
    expect(detectTransaction("خونه ۵۰ متری")).toBeNull();
    expect(detectTransaction("پیانو")).toBeNull();
  });

  it("detects rent/buy with word boundaries (inflected forms included)", async () => {
    const { detectTransaction } = await import("@/lib/interpret");
    expect(detectTransaction("خونه اجاره‌ای")).toBe("rent");
    expect(detectTransaction("آپارتمان فروشی")).toBe("buy");
    expect(detectTransaction("رهن کامل")).toBe("rent");
  });
});

describe("detectCondition", () => {
  it("detects new from نو / آکبند / صفر", async () => {
    const { detectCondition } = await import("@/lib/interpret");
    expect(detectCondition("آیفون نو")).toBe("new");
    expect(detectCondition("گوشی آکبند")).toBe("new");
    expect(detectCondition("پراید صفر")).toBe("new");
  });

  it("detects used from کارکرده / دست دوم", async () => {
    const { detectCondition } = await import("@/lib/interpret");
    expect(detectCondition("مبل کارکرده")).toBe("used");
    expect(detectCondition("گوشی دست دوم")).toBe("used");
    expect(detectCondition("یخچال دست‌دوم")).toBe("used");
  });

  it("is word-boundary safe: نوع is not نو", async () => {
    const { detectCondition } = await import("@/lib/interpret");
    expect(detectCondition("هر نوع مبل")).toBeNull();
    expect(detectCondition("۲۰۶")).toBeNull();
  });

  it("emits a condition constraint in interpretQuery", () => {
    const { applied } = interpretQuery("آیفون نو");
    const c = applied.find((x) => x.kind === "condition");
    expect(c?.value).toBe("new");
    expect(c?.display).toBe("نو");
  });
});

describe("detectServiceIntent — P0 (HumanTest S3)", () => {
  it("detects service demand: تعمیر / تعمیرکار / نصب / نصاب", async () => {
    const { detectServiceIntent } = await import("@/lib/interpret");
    expect(detectServiceIntent("تعمیر یخچال")).toBe(true);
    expect(detectServiceIntent("تعمیرکار یخچال در منزل")).toBe(true);
    expect(detectServiceIntent("تعمیرات تخصصی موبایل")).toBe(true);
    expect(detectServiceIntent("نصاب کولر گازی")).toBe(true);
    expect(detectServiceIntent("نصب کولر گازی در محل")).toBe(true);
  });

  it("Q4 guard: تعمیری / تعمیرشده reads as repaired GOODS, not service", async () => {
    const { detectServiceIntent } = await import("@/lib/interpret");
    expect(detectServiceIntent("یخچال تعمیری")).toBe(false);
    expect(detectServiceIntent("یخچال تعمیرشده")).toBe(false);
    expect(detectServiceIntent("گوشی تعمیری سالم")).toBe(false);
  });

  it("stays silent on goods queries", async () => {
    const { detectServiceIntent } = await import("@/lib/interpret");
    expect(detectServiceIntent("یخچال")).toBe(false);
    expect(detectServiceIntent("آیفون ۱۳")).toBe(false);
    expect(detectServiceIntent("")).toBe(false);
  });

  it("is word-boundary safe", async () => {
    const { detectServiceIntent } = await import("@/lib/interpret");
    // «تعمیرگاه» (repair SHOP as a place noun) is not in the demand list —
    // must not fire via substring.
    expect(detectServiceIntent("تعمیرگاه")).toBe(false);
  });
});

describe("detectCategoryFromText", () => {
  it("hints goods categories from head words", async () => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText("۲۰۶ تیپ ۲")).toBe("vehicles");
    expect(detectCategoryFromText("آیفون ۱۳")).toBe("mobile");
    expect(detectCategoryFromText("مبل راحتی")).toBe("home");
    expect(detectCategoryFromText("پیانو")).toBe("music");
    expect(detectCategoryFromText("مانتو")).toBe("personal");
  });

  it("keeps real estate first (preserves #4 behavior)", async () => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText("خونه و ماشین")).toBe("real-estate");
    expect(detectCategoryFromText("خونه ۵۰ متری")).toBe("real-estate");
  });

  it("returns null when nothing matches — never guesses", async () => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText("چیز عجیب")).toBeNull();
  });
});

/**
 * Big double-check (navid, 2026-10-15): the peanut incident showed one
 * misclassification can hide a bigger problem. This battery reviews every
 * category with adversarial queries — ambiguous head words, compounds,
 * and cross-category brands.
 */
describe("category double-check battery", () => {
  const cases: Array<[query: string, expected: string | null]> = [
    // vehicles — and its impostors
    ["پراید ۱۳۱ مدل ۹۸", "vehicles"],
    ["پژو ۲۰۶", "vehicles"],
    ["ماشین لباسشویی", "home"], // NOT vehicles
    ["ماشین ظرفشویی بوش", "home"], // NOT vehicles
    ["ماشین حساب", null], // NOT vehicles; nothing better either
    // mobile — and its impostors
    ["آیفون ۱۳ پرو", "mobile"],
    ["گوشی سامسونگ", "mobile"],
    ["یخچال سامسونگ", "home"], // NOT mobile — Samsung makes fridges too
    ["تلویزیون سامسونگ", "home"], // NOT mobile
    ["میز کنسول", "home"], // NOT mobile — furniture, not a game console
    ["کنسول بازی", "mobile"],
    // home — and smart-home modifiers
    ["مبل راحتی", "home"],
    // «خانه هوشمند» is genuinely ambiguous (smart apartment vs smart-home
    // gear); the standing real-estate-first precedence decides. Documented,
    // not a bug like the peanut case.
    ["خانه هوشمند", "real-estate"],
    ["ساعت هوشمند", "personal"], // via «ساعت», not «هوشمند»
    ["میز ناهارخوری", "home"],
    // real estate — and the peanut incident
    ["آپارتمان نوساز", "real-estate"],
    ["زمین کشاورزی", "real-estate"],
    ["بادام زمینی", null], // prod incident 2026-10-15 — NOT real-estate
    ["ویلا شمال", "real-estate"],
    // music / personal sanity
    ["پیانو آکوستیک", "music"],
    ["مانتو زنانه", "personal"],
  ];

  it.each(cases)("«%s» → %s", async (query, expected) => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText(query)).toBe(expected);
  });
});

/**
 * Category expansion (navid, 2026-10-15): 6 categories are too few — align
 * with Divar's top-level taxonomy (services, jobs, industrial) and widen
 * the goods lists. Every new word earned its place by surviving the
 * adversarial pass below: ambiguous candidates («پکیج»، «نظافت»،
 * «آموزش») were REJECTED, not added.
 */
describe("category expansion battery", () => {
  const cases: Array<[query: string, expected: string | null]> = [
    // services — demand patterns first (P0), standalone words second
    ["تعمیر یخچال", "services"],
    ["تعمیرات تخصصی موبایل", "services"],
    ["نصاب کولر گازی می‌خوام", "services"],
    ["تعمیرکار یخچال", "services"],
    ["قالیشویی", "services"],
    ["باربری تهران", "services"],
    ["تعمیرگاه مجاز", "services"],
    // ...but repaired/installed GOODS stay goods (Q4 family)
    ["یخچال تعمیری", "home"],
    ["کولر نصب شده", "home"],
    // jobs
    ["استخدام منشی", "jobs"],
    ["کاریابی", "jobs"],
    // industrial — phrase-only triggers
    ["ماشین‌آلات صنعتی", "industrial"],
    ["خط تولید", "industrial"],
    ["تجهیزات صنعتی", "industrial"],
    ["دستگاه قهوه‌ساز", null], // bare «دستگاه» is ambiguous — never guess
    // leisure (id "music" is historical)
    ["دوچرخه", "music"],
    ["کتاب", "music"],
    ["اسباب‌بازی", "music"],
    // expanded goods lists
    ["موتور هوندا", "vehicles"],
    ["موتورسیکلت", "vehicles"],
    ["موتور یخچال", "home"], // engine, not a bike
    ["مک‌بوک پرو", "mobile"],
    ["ایرپاد", "mobile"],
    ["بخاری برقی", "home"],
    ["سرویس خواب", "home"],
    ["هود آشپزخانه", "home"],
    ["شال زنانه", "personal"],
    ["کلاه", "personal"],
    ["ملک تجاری", "real-estate"],
    // rejected candidates stay null (documented, not forgotten)
    ["پکیج آموزشی", null], // «پکیج» also means course package
    ["پکیج دیواری", "home"], // ...but the phrase is unambiguous
    ["دفتر مشق", null], // stationery, NOT real estate (peanut family)
    ["دفتر کار", "real-estate"], // guard the guard: offices stay real estate
    ["تیپ مردانه", null], // clothing style, NOT a car trim
    ["چیز عجیب", null],
  ];

  it.each(cases)("«%s» → %s", async (query, expected) => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText(query)).toBe(expected);
  });

  it("isServicesQuery guards installed goods", async () => {
    const { isServicesQuery } = await import("@/lib/interpret");
    expect(isServicesQuery("تعمیر یخچال")).toBe(true);
    expect(isServicesQuery("نصاب کولر")).toBe(true);
    expect(isServicesQuery("قالیشویی")).toBe(true);
    expect(isServicesQuery("کولر نصب شده")).toBe(false);
    expect(isServicesQuery("یخچال تعمیری")).toBe(false);
    expect(isServicesQuery("یخچال")).toBe(false);
  });
});

/**
 * R3 battery round 2 (DeepSeek, triaged by musi, 2026-10-16): 60 adversarial
 * variants around the 10 locked R3 hunts → 13 hard divergences → 7 fixes.
 * The separator-agnostic matcher (indexTokens) replaced the ZWNJ-only
 * tolerance: every separator spelling of a compound now matches, while
 * short words still can't fire inside compounds («قهوه‌ساز» ≠ «ساز»).
 */
describe("R3 battery round 2", () => {
  const cases: Array<[query: string, expected: string | null]> = [
    // separator-agnostic compounds — every spelling lands the same
    ["ماشین لباسشویی", "home"],
    ["ماشین لباس‌شویی", "home"], // ZWNJ spelling
    ["ماشین لباس شویی", "home"], // spaced spelling
    ["ماشین رختشویی", "home"], // synonym
    ["ماشین رخت‌شویی", "home"],
    ["لپ‌تاپ", "mobile"],
    ["لپ تاپ", "mobile"],
    ["لپتاپ", "mobile"],
    ["سه‌تار", "music"],
    ["سه تار", "music"],
    // alef folding — the most common Persian keyboard variation
    ["ایفون ۱۳ پرو", "mobile"], // ا instead of آ
    ["اپارتمان نوساز", "real-estate"],
    // synonyms
    ["اتومبیل بدون رنگ", "vehicles"],
    // agentive forms — joined, ZWNJ, spaced
    ["نصبکننده کولر گازی", "services"],
    ["نصب‌کننده کولر گازی", "services"],
    ["نصب کننده کولر گازی", "services"],
    // possessive / plural suffixes
    ["میخوام پرایدم رو بفروشم", "vehicles"],
    ["ماشینم", "vehicles"],
    ["پرایدها", "vehicles"],
    // short words still can't fire inside ZWNJ-joined compounds (the قهوه‌ساز guard)
    ["دستگاه قهوه‌ساز", null],
    ["قهوه‌ساز", null],
  ];

  it.each(cases)("«%s» → %s", async (query, expected) => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText(query)).toBe(expected);
  });

  it("«بی‌رنگ» in every spelling excludes «رنگ» like «بدون رنگ»", async () => {
    const { interpretQuery } = await import("@/lib/interpret");
    for (const q of ["ماشین بیرنگ", "ماشین بی‌رنگ", "ماشین بی رنگ", "ماشین بدون رنگ"]) {
      const { applied } = interpretQuery(q);
      expect(applied.some((c) => c.kind === "exclude" && c.value === "رنگ")).toBe(true);
    }
  });

  it("possessive stemmer never mangles short words", async () => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    // «نام»/«شام»/«تنها» must not stem (stem < 4 chars) — and none of these
    // are category words anyway, so the classifier stays silent, not wrong.
    expect(detectCategoryFromText("نام")).toBeNull();
    expect(detectCategoryFromText("شام")).toBeNull();
  });
});

describe("R3 battery round 2 — ZWNJ-joined multi-word tokens", () => {
  it.each([
    ["ماشین‌لباسشویی", "home"], // ZWNJ between two full words
    ["ماشین‌ظرفشویی", "home"],
  ])("«%s» → %s", async (query, expected) => {
    const { detectCategoryFromText } = await import("@/lib/interpret");
    expect(detectCategoryFromText(query)).toBe(expected);
  });

  it("long-word substring never fires for short words", async () => {
    const { includesWordSmart } = await import("@/lib/interpret");
    const { normalizePersian } = await import("@/lib/normalizePersian");
    const n = normalizePersian("دستگاه قهوه‌ساز");
    expect(includesWordSmart(n, "ساز")).toBe(false); // 3 chars: token-only
    expect(includesWordSmart(n, "قهوه‌ساز")).toBe(true); // the compound itself matches
    // cross-token phantoms are impossible: «تعمیر یخچال» must not match «تعمیری»
    const n2 = normalizePersian("تعمیر یخچال");
    expect(includesWordSmart(n2, "تعمیری")).toBe(false);
  });
});
