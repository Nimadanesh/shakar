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
