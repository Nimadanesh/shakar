import { describe, expect, it } from "vitest";
import { assessModelSpecificity } from "./semantics";
import { queryKindForDef } from "./kindLexicon";

describe("Issue 16 — title subject outranks description-only mentions", () => {
  it.each([
    [
      "whole-vehicle hunt rejects a catalyst-only catalogue",
      ["خودرو"],
      "خودرو",
      "خرید فروش انواع کاتالیزور خارجی ایران فرسوده",
      "تعویض کاتالیزور نو؛ فروش انواع طرح های کاتالیز؛ خریدار کاتالیزور فرسوده خودرو",
      "all",
    ],
    [
      "whole-vehicle hunt rejects a body-parts catalogue",
      ["خودرو"],
      "خودرو",
      "بدنه کاپوت گلگیر سپر چراغ قیمت عمده",
      "پخش قطعات بدنه محصولات سایپا و ایران خودرو؛ فروش قطعات بدنه",
      "all",
    ],
    [
      "whole-vehicle hunt rejects a used body-parts listing",
      ["خودرو"],
      "خودرو",
      "فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند",
      "فروش انواع قطعات و بدنه استوک فابریک خودرو",
      "all",
    ],
    [
      "whole-vehicle hunt rejects a spare-parts catalogue",
      ["خودرو"],
      "خودرو",
      "فروش لوازم یدکی لیفان بدنه، موتوری و جلوبندی",
      "وارد کننده لوازم یدکی لیفان؛ قطعات بدنه و خودرو",
      "all",
    ],
  ])("%s", (_label, include, queryText, title, description, category) => {
    const terms = include as string[];
    const r = assessModelSpecificity(
      terms,
      `${title} ${description}`,
      category as string,
      queryKindForDef(terms, false, category as string),
      queryText as string,
      title as string
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain("part:title-offering:");
  });

  it("rejects a free catalyst-test mention on an exhaust listing for a catalyst hunt", () => {
    const include = ["کاتالیزور"];
    const title = "اگزوز (بیات) تیبا کوییک پژو سمند مارک مشهد";
    const description =
      "خدمات رایگان ما تست و بازدید دیاگ تست کاتالیزور جوشکاری و وصل اگزوز؛ موجودی اگزوز تیبا و پژو";
    const r = assessModelSpecificity(
      include,
      `${title} ${description}`,
      "all",
      queryKindForDef(include, false, "all"),
      "کاتالیزور",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain('part:title-offering:"اگزوز"');
  });

  it("preserves direct catalyst-offer titles and queries for the part itself", () => {
    const include = ["کاتالیزور"];
    for (const title of [
      "فروش وخرید انواع کاتالیزور و خاک ۲۰۶ پژو ال۹۰ نیسان",
      "جایگزین کاتالیزور پژو پارس و ۴۰۵ و اگزوز",
    ]) {
      const r = assessModelSpecificity(
        include,
        `${title} ${title}`,
        "all",
        queryKindForDef(include, false, "all"),
        "کاتالیزور",
        title
      );
      expect(r.mismatch).toBe(false);
    }

    const exhaustQuery = ["اگزوز"];
    const exhaustTitle = "اگزوز تیبا و پژو";
    const r = assessModelSpecificity(
      exhaustQuery,
      exhaustTitle,
      "all",
      queryKindForDef(exhaustQuery, false, "all"),
      "اگزوز",
      exhaustTitle
    );
    expect(r.mismatch).toBe(false);
  });

  // HANDOFF-3a (2026-11-01): before, this test expected mismatch=false
  // (a recorded leak: a service headline survived as a whole-vehicle
  // listing). After, it expects mismatch=true, tier reject, because this
  // title is equivalent to I16-B02, whose owner human grade is 4
  // (a service ad, not a vehicle). Date: 2026-11-01.
  it("preserves a whole-vehicle listing whose title offers a vehicle", () => {
    const include = ["خودرو"];
    const title = "کارشناسی وقیمت گذاری خودرو تصادفی و خریدار تصادفی";
    const r = assessModelSpecificity(
      include,
      `${title} پارس مدل 99 معاوضه با خودرو تصادفی`,
      "all",
      queryKindForDef(include, false, "all"),
      "خودرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain('part:title-offering:"کارشناسی"');
  });

  it("rejects title-led parts for the actual broad buy/sell-vehicle query", () => {
    const include = ["خرید", "فروش", "خودرو"];
    const title = "فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند";
    const description = "خرید و فروش خودرو و قطعات بدنه؛ فروش انواع بدنه استوک";
    const r = assessModelSpecificity(
      include,
      `${title} ${description}`,
      "all",
      queryKindForDef(include, false, "all"),
      "خرید و فروش خودرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain('part:title-offering:"بدنه"');
  });

  it("preserves a genuine whole-vehicle ad for the broad buy/sell-vehicle query", () => {
    const include = ["خرید", "فروش", "خودرو"];
    const title = "فروش فوری دنا پلاس توربو اتومات بدون رنگ 1400";
    const description = "خرید و فروش خودرو؛ فروش مستقیم خودروی دنا پلاس";
    const r = assessModelSpecificity(
      include,
      `${title} ${description}`,
      "all",
      queryKindForDef(include, false, "all"),
      "خرید و فروش خودرو",
      title
    );
    expect(r.mismatch).toBe(false);
  });

  it("keeps Issue 16 cues out of the legacy text-only identity path", () => {
    const include = ["خودرو"];
    const r = assessModelSpecificity(
      include,
      "بدنه خودرو",
      "all",
      queryKindForDef(include, false, "all"),
      "خودرو"
      // Deliberately omit listingTitle: Issue 16's new cues are title-only.
    );
    expect(r.mismatch).toBe(false);
  });

  it("type-only «خودرو» query does not mismatch on a «پلاس» variant", () => {
    const include = ["خودرو"];
    const title = "فروش دنا پلاس دنده‌ای مدل ۱۴۰۰";
    const r = assessModelSpecificity(
      include,
      `${title} خرید و فروش خودرو`,
      "all",
      queryKindForDef(include, false, "all"),
      "خودرو",
      title
    );
    expect(r.mismatch).toBe(false);
  });

  it("records current behaviour for single-word «دنا» outside the type-only list (not endorsed)", () => {
    const include = ["دنا"];
    const title = "دنا پلاس";
    const r = assessModelSpecificity(
      include,
      title,
      "all",
      queryKindForDef(include, false, "all"),
      "دنا",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
    expect(r.reason).toContain('sibling-variant:listing-adds:"پلاس"');
  });

  it("specific «آیفون ۱۳ پرو» query still caps «پرو مکس» at near", () => {
    const include = ["آیفون", "۱۳", "پرو"];
    const title = "آیفون ۱۳ پرو مکس";
    const r = assessModelSpecificity(
      include,
      title,
      "all",
      queryKindForDef(include, false, "all"),
      "آیفون ۱۳ پرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
    expect(r.reason).toContain('sibling-variant:listing-adds:"مکس"');
  });

  it("records current behaviour for «وانت» on the broad buy/sell-vehicle query", () => {
    const include = ["خرید", "فروش", "خودرو"];
    const title = "فروش وانت نیسان";
    const r = assessModelSpecificity(
      include,
      `${title} خرید و فروش خودرو؛ فروش وانت نیسان`,
      "all",
      queryKindForDef(include, false, "all"),
      "خرید و فروش خودرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
    expect(r.reason).toContain('sibling-variant:subject:"وانت"');
  });

  it("broad buy/sell-vehicle query still rejects a spare-parts title", () => {
    const include = ["خرید", "فروش", "خودرو"];
    const title = "فروش لوازم یدکی پراید";
    const r = assessModelSpecificity(
      include,
      `${title} خرید و فروش خودرو؛ فروش لوازم یدکی پراید`,
      "all",
      queryKindForDef(include, false, "all"),
      "خرید و فروش خودرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain('part:title-offering:"لوازم یدکی"');
  });

  // HANDOFF-3a (2026-11-01): a part/service word that is NOT the title
  // head must not reject a whole-vehicle listing, and a whole-vehicle
  // title head must not reject when the query itself hunts that head
  // or names a different type. Only the headline rejects below.
  it.each([
    ["پراید ۱۳۱ مدل ۹۸ بدنه سالم", ["خرید", "فروش", "خودرو"], "خرید و فروش خودرو"],
    ["پژو ۲۰۶ تیپ ۲ موتور تازه تعمیر", ["خرید", "فروش", "خودرو"], "خرید و فروش خودرو"],
    ["فردا موتور FMC511 صفر", ["خرید", "فروش", "خودرو"], "خرید و فروش خودرو"],
    ["فروش فوری اقساطی تویوتا کرولا", ["خرید", "فروش", "خودرو"], "خرید و فروش خودرو"],
    ["فروش اقساطی خودرو", ["خرید", "فروش", "خودرو"], "خرید و فروش خودرو"],
  ])("whole-vehicle query does not reject a non-head part/service word: %s", (title, include, queryText) => {
    const terms = include as string[];
    const r = assessModelSpecificity(
      terms,
      `${title} خرید و فروش خودرو`,
      "vehicles",
      queryKindForDef(terms, false, "vehicles"),
      queryText as string,
      title as string
    );
    expect(r.tier).not.toBe("reject");
    expect(r.reason).not.toContain("part:title-offering:");
  });

  it("whole-vehicle query rejects a service headline", () => {
    const include = ["خرید", "فروش", "خودرو"];
    const title = "صافکاری و نقاشی خودرو";
    const r = assessModelSpecificity(
      include,
      `${title} خرید و فروش خودرو`,
      "vehicles",
      queryKindForDef(include, false, "vehicles"),
      "خرید و فروش خودرو",
      title
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("reject");
    expect(r.reason).toContain('part:title-offering:"صافکاری"');
  });

  it("a query that itself hunts the head is not rejected", () => {
    const include = ["صافکاری", "خودرو"];
    const title = "صافکاری و نقاشی خودرو";
    const r = assessModelSpecificity(
      include,
      title,
      "vehicles",
      queryKindForDef(include, false, "vehicles"),
      "صافکاری خودرو",
      title
    );
    expect(r.tier).not.toBe("reject");
  });

  it("a tire query is not rejected for its own tire title", () => {
    const include = ["لاستیک"];
    const title = "لاستیک بارز سایز ۱۴";
    const r = assessModelSpecificity(
      include,
      title,
      "vehicles",
      queryKindForDef(include, false, "vehicles"),
      "لاستیک",
      title
    );
    expect(r.tier).not.toBe("reject");
  });

  it("records today's behaviour for a piano title with a body word (not endorsed, vehicle rule only)", () => {
    const include = ["پیانو"];
    const title = "پیانو دیجیتال بدنه سالم";
    const r = assessModelSpecificity(
      include,
      title,
      "vehicles",
      queryKindForDef(include, false, "vehicles"),
      "پیانو",
      title
    );
    expect(r.mismatch).toBe(false);
    expect(r.tier).toBe("near");
    expect(r.reason).toBe("no-extra-variant");
  });
});

describe("HANDOFF-K — general kind gate (closed lists, GOLDEN-REPORT-2 titles)", () => {
  type Expectation =
    | { kind: "reject"; reason: string }
    | { kind: "near"; reason: string }
    | { kind: "not-rejected" };
  const cases: [
    string,
    string[],
    string,
    string,
    string | undefined,
    Expectation,
  ][] = [
    [
      "K2: game head for a console hunt rejects",
      ["نینتندو", "سوییچ"],
      "نینتندو سوییچ",
      "بازی Super Mario Odyssey برای نینتندو سوییچ ۱",
      undefined,
      { kind: "reject", reason: "kind:game-for-console" },
    ],
    [
      "K2: game head with the سویچ spelling variant rejects",
      ["نینتندو", "سوییچ"],
      "نینتندو سوییچ",
      "بازی اسپرت نینتندو سویچ",
      undefined,
      { kind: "reject", reason: "kind:game-for-console" },
    ],
    [
      "K1: service head after a sale cue rejects",
      ["نینتندو", "سوییچ"],
      "نینتندو سوییچ",
      "فروش خدمات نینتندو سوییچ Nintendo PS5 بازی نصبشده",
      undefined,
      { kind: "reject", reason: "kind:service-head" },
    ],
    [
      "K1: glued خریدفروش is a filler, so the head is خدمات",
      ["نینتندو", "سوییچ"],
      "نینتندو سوییچ",
      "خریدفروش خدمات نینتندو سوییچ Nintendoبازی نصبشده",
      undefined,
      { kind: "reject", reason: "kind:service-head" },
    ],
    [
      "K2: a console itself with games mentioned later does not reject",
      ["نینتندو", "سوییچ"],
      "نینتندو سوییچ",
      "نینتندو سوییچ لایت مرجانی کپی‌خور با ۴۵ بازی خاص",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K2: a hunt for games does not reject a game head",
      ["بازی", "نینتندو", "سوییچ"],
      "بازی نینتندو سوییچ",
      "بازی اسپرت نینتندو سویچ",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K3: برای followed by a non-query word does not reject",
      ["تلسکوپ"],
      "تلسکوپ",
      "تلسکوپ برای دیدن ماه و سیارات",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K4: store marker with no query number in the title rejects",
      ["آیفون", "15", "پرو"],
      "آیفون 15 پرو",
      "انواع آیفون موجود است",
      undefined,
      { kind: "reject", reason: "kind:store-listing" },
    ],
    [
      "K4: مدل های جدید marker rejects",
      ["آیفون", "15", "پرو"],
      "آیفون 15 پرو",
      "مدل های جدید آیفون",
      undefined,
      { kind: "reject", reason: "kind:store-listing" },
    ],
    [
      "K4: title carrying the query number does not reject",
      ["آیفون", "15", "پرو"],
      "آیفون 15 پرو",
      "انواع آیفون ۱۵ موجود است",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K4: a query with no number does not reject a store listing",
      ["آیفون"],
      "آیفون",
      "انواع آیفون موجود است",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K5: rent-only title in a buy hunt rejects",
      ["آپارتمان"],
      "آپارتمان",
      "اجاره آپارتمان ۹۰ متری وکیل آباد",
      "buy",
      { kind: "reject", reason: "transaction:rent-only" },
    ],
    [
      "K5: هتل آپارتمان phrase in a buy hunt rejects",
      ["آپارتمان"],
      "آپارتمان",
      "هتل آپارتمان مشهد",
      "buy",
      { kind: "reject", reason: "transaction:rent-only" },
    ],
    [
      "K5: mixed rent+sell title caps at tier 3, never rejects",
      ["آپارتمان"],
      "آپارتمان",
      "فروش یا اجاره آپارتمان ۱۰۰ متری",
      "buy",
      { kind: "near", reason: "transaction:mixed" },
    ],
    [
      "K5: a sell-only title in a buy hunt does not reject",
      ["ویلا"],
      "ویلا",
      "فروش منزل ویلای واقع در کرونی با سند تک برگ",
      "buy",
      { kind: "not-rejected" },
    ],
    [
      "3a untouched: a catalyst catalogue still rejects with part:",
      ["خرید", "فروش", "خودرو"],
      "خرید و فروش خودرو",
      "خرید فروش انواع کاتالیزور",
      undefined,
      { kind: "reject", reason: "part:title-offering:\"کاتالیزور\"" },
    ],
    [
      "K1 correction: a service-word query does not reject a خدمات head",
      ["نصب", "کولر"],
      "نصب کولر",
      "خدمات نصب کولر",
      undefined,
      { kind: "not-rejected" },
    ],
    [
      "K5 correction: مبله دربست phrase in a buy hunt rejects",
      ["ویلا"],
      "ویلا",
      "ویلا مبله دربست",
      "buy",
      { kind: "reject", reason: "transaction:rent-only" },
    ],
    [
      "K5 correction: bare دربست without مبله does not reject",
      ["آپارتمان"],
      "آپارتمان",
      "ساختمان دربست ۳ طبقه",
      "buy",
      { kind: "not-rejected" },
    ],
  ];
  it.each(cases)(
    "%s",
    (_label, include, queryText, title, transaction, expected) => {
      const r = assessModelSpecificity(
        include,
        title,
        "all",
        queryKindForDef(include, false, "all"),
        queryText,
        title,
        transaction
      );
      if (expected.kind === "reject") {
        expect(r.mismatch).toBe(true);
        expect(r.tier).toBe("reject");
        expect(r.reason).toBe(expected.reason);
      } else if (expected.kind === "near") {
        expect(r.mismatch).toBe(true);
        expect(r.tier).toBe("near");
        expect(r.reason).toBe(expected.reason);
      } else {
        expect(r.mismatch && r.tier === "reject").toBe(false);
      }
    }
  );
});

describe("HANDOFF-1 — general gate: services, buyer, accessories", () => {
  const cases: Array<
    [
      string,
      string[],
      string,
      string,
      (
        | { kind: "reject"; reason: string }
        | { kind: "not-rejected" }
      ),
    ]
  > = [
    // G1 — service heads (all hunts).
    [
      "G1: تعمیرات head rejects for a laptop hunt",
      ["لپ‌تاپ"],
      "لپ‌تاپ",
      "تعمیرات تخصصی لپ‌تاپ در محل",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: آموزش head rejects for a guitar hunt",
      ["گیتار"],
      "گیتار",
      "آموزش گیتار مقدماتی",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: کلاس head rejects for a violin hunt",
      ["ویولن"],
      "ویولن",
      "کلاس خصوصی ویولن",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: نصب head rejects for a cooler hunt",
      ["کولر", "گازی"],
      "کولر گازی",
      "نصب کولر گازی با ضمانت",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: ساخت head rejects for a TV-stand hunt",
      ["میز", "تلویزیون"],
      "میز تلویزیون",
      "ساخت میز تلویزیون سفارشی",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: تعویض head rejects for a laptop hunt",
      ["لپ‌تاپ"],
      "لپ‌تاپ",
      "تعویض باتری لپ‌تاپ در محل",
      { kind: "reject", reason: "kind:service-head-general" },
    ],
    [
      "G1: a service-word query does not reject its own head",
      ["آموزش", "گیتار"],
      "آموزش گیتار",
      "آموزش گیتار مقدماتی",
      { kind: "not-rejected" },
    ],
    [
      "G1: نصب‌شده is installed, not an installer",
      ["تلویزیون"],
      "تلویزیون",
      "نصب‌شده روی دیوار، تلویزیون ۵۵ اینچ",
      { kind: "not-rejected" },
    ],
    [
      "G1: ساخت + origin word is made-in, not a maker",
      ["چرخ", "خیاطی"],
      "چرخ خیاطی",
      "ساخت ژاپن، چرخ خیاطی برقی",
      { kind: "not-rejected" },
    ],
    [
      "G1: تعویض + با is an exchange offer, not a service",
      ["آیفون", "۱۳"],
      "آیفون ۱۳",
      "تعویض با گوشی بالاتر، آیفون ۱۳",
      { kind: "not-rejected" },
    ],
    [
      "G1: طرح + تعویض is a plan, not a service",
      ["یخچال"],
      "یخچال",
      "طرح تعویض یخچال کهنه با نو",
      { kind: "not-rejected" },
    ],
    [
      "G1: طرح + نوسازی is a plan, not a service",
      ["کولر", "آبی"],
      "کولر آبی",
      "طرح نوسازی کولر آبی",
      { kind: "not-rejected" },
    ],
    [
      "G1 amendment 4: کلاس + Latin letter/model is a car class, not a service",
      ["بنز"],
      "بنز",
      "کلاس E 200 بنز",
      { kind: "not-rejected" },
    ],
    // G2 — buyer.
    [
      "G2: خریدار head rejects for a fridge hunt",
      ["یخچال"],
      "یخچال",
      "خریدار یخچال کارکرده",
      { kind: "reject", reason: "direction:buyer" },
    ],
    [
      "G2: خرید + scrap trigger rejects for a cooler hunt",
      ["کولر"],
      "کولر",
      "خرید کولر فرسوده به بالاترین قیمت",
      { kind: "reject", reason: "direction:buyer" },
    ],
    [
      "G2: خریداریم anywhere rejects for a vacuum hunt",
      ["جاروبرقی"],
      "جاروبرقی",
      "جاروبرقی خریداریم",
      { kind: "reject", reason: "direction:buyer" },
    ],
    [
      "G2: خرید + فوری without a trigger does not reject",
      ["تلویزیون"],
      "تلویزیون",
      "خرید فوری تلویزیون ۵۵ اینچ",
      { kind: "not-rejected" },
    ],
    // G3 — accessory heads.
    [
      "G3: کیف head rejects for a laptop hunt",
      ["لپ‌تاپ"],
      "لپ‌تاپ",
      "کیف لپ‌تاپ ۱۵ اینچ",
      { kind: "reject", reason: "kind:accessory-head" },
    ],
    [
      "G3: قاب head rejects for a Samsung phone hunt",
      ["گوشی", "سامسونگ"],
      "گوشی سامسونگ",
      "قاب گوشی سامسونگ A54",
      { kind: "reject", reason: "kind:accessory-head" },
    ],
    [
      "G3: شارژر head rejects for a laptop hunt",
      ["لپ‌تاپ"],
      "لپ‌تاپ",
      "شارژر لپ‌تاپ اصل",
      { kind: "reject", reason: "kind:accessory-head" },
    ],
    [
      "G3: میز head rejects for a TV hunt",
      ["تلویزیون"],
      "تلویزیون",
      "میز تلویزیون چوبی",
      { kind: "reject", reason: "kind:accessory-head" },
    ],
    [
      "G3: پایه head rejects for a telescope hunt (پایه‌دار is not پایه)",
      ["تلسکوپ", "نجومی", "پایه‌دار"],
      "تلسکوپ نجومی حتماً پایه دار",
      "پایه تلسکوپ آلومینیومی",
      { kind: "reject", reason: "kind:accessory-head" },
    ],
    [
      "G3: و between head and subject deactivates the rule",
      ["میز", "تحریر"],
      "میز تحریر",
      "صندلی و میز تحریر",
      { kind: "not-rejected" },
    ],
    [
      "G3: a brand/model head in the include has no effect",
      ["گوشی", "سامسونگ"],
      "گوشی سامسونگ",
      "سامسونگ گلکسی A54 گوشی سالم",
      { kind: "not-rejected" },
    ],
    [
      "G3 amendment 2: قطعه is not an accessory head (قطعه زمین)",
      ["زمین"],
      "زمین",
      "قطعه زمین مسکونی ۲۰۰ متری",
      { kind: "not-rejected" },
    ],
    [
      "G3 amendment 3: با between head and subject deactivates the rule",
      ["صندلی"],
      "صندلی",
      "میز ناهارخوری با صندلی",
      { kind: "not-rejected" },
    ],
    // G0 — generic heads are only head-finding fillers.
    [
      "G0: ساز is skipped, the guitar itself is not rejected",
      ["گیتار"],
      "گیتار",
      "ساز گیتار کلاسیک یاماها",
      { kind: "not-rejected" },
    ],
    [
      "G0: وسیله is skipped, the treadmill itself is not rejected",
      ["تردمیل"],
      "تردمیل",
      "وسیله ورزشی تردمیل خانگی",
      { kind: "not-rejected" },
    ],
    [
      "G0+G4: دستگاه before the subject is a counter, not equipment",
      ["تردمیل"],
      "تردمیل",
      "دستگاه تردمیل برقی",
      { kind: "not-rejected" },
    ],
    [
      "G0: پک is skipped, the guitar itself is not rejected",
      ["گیتار", "الکتریک"],
      "گیتار الکتریک",
      "پک گیتار الکتریک با آمپ",
      { kind: "not-rejected" },
    ],
    [
      "G0: ست is skipped, the pot itself is not rejected",
      ["قابلمه"],
      "قابلمه",
      "ست قابلمه گرانیتی",
      { kind: "not-rejected" },
    ],
    [
      "G0: دو عدد is skipped, the headphone itself is not rejected",
      ["هدفون"],
      "هدفون",
      "دو عدد هدفون بی‌سیم",
      { kind: "not-rejected" },
    ],
    [
      "G0: دوعدد is skipped, the headphone itself is not rejected",
      ["هدفون"],
      "هدفون",
      "دوعدد هدفون",
      { kind: "not-rejected" },
    ],
    [
      "G0: فروش/نو/آکبند/دستگاه are skipped, the treadmill is not rejected",
      ["تردمیل"],
      "تردمیل",
      "فروش نو آکبند دستگاه تردمیل",
      { kind: "not-rejected" },
    ],
    [
      "G0: اصل is skipped, the headphone itself is not rejected",
      ["هدفون", "سونی"],
      "هدفون سونی",
      "اصل هدفون سونی",
      { kind: "not-rejected" },
    ],
  ];
  it.each(cases)(
    "%s",
    (_label, include, queryText, title, expected) => {
      const r = assessModelSpecificity(
        include,
        title,
        "all",
        queryKindForDef(include, false, "all"),
        queryText,
        title
      );
      if (expected.kind === "reject") {
        expect(r.mismatch).toBe(true);
        expect(r.tier).toBe("reject");
        expect(r.reason).toBe(expected.reason);
      } else {
        expect(r.mismatch && r.tier === "reject").toBe(false);
      }
    }
  );

  it("G2: a buy-and-sell catalogue title caps at near, never rejects", () => {
    const r = assessModelSpecificity(
      ["لپ‌تاپ"],
      "خرید و فروش لپ‌تاپ استوک",
      "all",
      queryKindForDef(["لپ‌تاپ"], false, "all"),
      "لپ‌تاپ",
      "خرید و فروش لپ‌تاپ استوک"
    );
    expect(r.mismatch).toBe(true);
    expect(r.tier).toBe("near");
    expect(r.reason).toBe("store:buy-sell");
  });

  it("G2: a buy-and-sell query is untouched by G2", () => {
    const r = assessModelSpecificity(
      ["خرید", "فروش", "خودرو"],
      "خرید و فروش پراید",
      "all",
      queryKindForDef(["خرید", "فروش", "خودرو"], false, "all"),
      "خرید و فروش خودرو",
      "خرید و فروش پراید"
    );
    expect(r.tier).not.toBe("reject");
    expect(r.reason).not.toBe("direction:buyer");
    expect(r.reason).not.toBe("store:buy-sell");
  });

  it("amendment 1: a non-list head leaves the rank unchanged", () => {
    const r = assessModelSpecificity(
      ["تلویزیون"],
      "دیوارکوب تلویزیون متحرک",
      "all",
      queryKindForDef(["تلویزیون"], false, "all"),
      "تلویزیون",
      "دیوارکوب تلویزیون متحرک"
    );
    expect(r.mismatch).toBe(false);
    expect(r.reason).toBe("no-extra-variant");
    expect(r.tier).toBe("near");
  });

  it("HANDOFF-1B: G1 is off when the query itself wants an installer", () => {
    const r = assessModelSpecificity(
      ["نصاب", "کولر", "گازی"],
      "نصب و تعمیر کولر گازی",
      "all",
      queryKindForDef(["نصاب", "کولر", "گازی"], false, "all"),
      "نصاب کولر گازی می‌خوام",
      "نصب و تعمیر کولر گازی"
    );
    expect(r.mismatch && r.tier === "reject").toBe(false);
  });

  it("HANDOFF-1B: G2 is off when the query itself wants a seller", () => {
    const r = assessModelSpecificity(
      ["یخچال"],
      "خریدار یخچال کارکرده",
      "all",
      queryKindForDef(["یخچال"], false, "all"),
      "فروشنده یخچال",
      "خریدار یخچال کارکرده"
    );
    expect(r.mismatch && r.tier === "reject").toBe(false);
    expect(r.reason).not.toBe("direction:buyer");
  });
});
