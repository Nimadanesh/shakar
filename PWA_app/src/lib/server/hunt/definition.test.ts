import { describe, expect, it } from "vitest";

import { parsePriceBound, resolveHuntDefinition } from "./definition";
import { textMatches } from "@/lib/persianNormalize";

function body(over: Record<string, unknown> = {}) {
  return {
    query: "پیانو U3 تهران",
    include: [],
    exclude: [],
    city: "all",
    category: "all",
    priceMin: "",
    priceMax: "",
    transaction: "",
    condition: "",
    ...over,
  };
}

describe("resolveHuntDefinition — negated repair history", () => {
  it("routes «پیانو تعمیر یا تعویض نشده است» to product + absent attributes", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو تعمیر یا تعویض نشده است", category: "music" })
    )!;
    expect(def.include).toContain("پیانو");
    expect(def.include).not.toContain("تعمیر");
    expect(def.include).not.toContain("یا");
    expect(def.include).not.toContain("است");
    expect(def.absentAttributes).toContain("تعویض");
    expect(def.absentAttributes).toContain("تعمیر");
    expect(def.serviceIntent).toBe(false);
  });

  it("does not remove repair terms from a positive service hunt", () => {
    const def = resolveHuntDefinition(
      body({ query: "تعمیر یخچال", category: "services" })
    )!;
    expect(def.include).toContain("تعمیر");
    expect(def.serviceIntent).toBe(true);
  });
});

describe("resolveHuntDefinition — the «پیانو» incident (2026-10-06)", () => {
  it("makes the query's content terms mandatory", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.include).toContain("پیانو");
    expect(def.include).toContain("U3");
    // Structural words never become content terms.
    expect(def.include).not.toContain("تهران");
  });

  it("a pigeon ad can no longer pass a piano hunt", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.include.length).toBeGreaterThan(0);
    // The old code passed EVERY ad vacuously (include=[]). Now every
    // mandatory term must match — «کفتر» matches none of them.
    const pigeonPasses = def.include.every((t) =>
      textMatches("کفتر مسابقه‌ای اصیل", t)
    );
    expect(pigeonPasses).toBe(false);
    const pianoPasses = def.include.every((t) =>
      textMatches("پیانو یاماها U3 در حد آکبند", t)
    );
    expect(pianoPasses).toBe(true);
  });

  it("applies the text city when the picker is all", () => {
    expect(resolveHuntDefinition(body())!.city).toBe("tehran");
  });

  it("text city beats a stored/remembered picker value (navid 2026-10-08)", () => {
    // The piano hunt DISPLAYED تهران but searched تبریز — the remembered
    // picker silently won. The query text is the freshest signal.
    const def = resolveHuntDefinition(body({ city: "tabriz" }))!;
    expect(def.city).toBe("tehran");
    expect(def.citySource).toBe("text");
  });

  it("a dismissed city inference keeps the picker value", () => {
    const def = resolveHuntDefinition(
      body({ city: "tabriz", dismissed: ["city:tehran"] })
    )!;
    expect(def.city).toBe("tabriz");
    expect(def.citySource).toBe("picker");
  });

  it("records citySource picker when the text names no city", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو U3", city: "tabriz" })
    )!;
    expect(def.city).toBe("tabriz");
    expect(def.citySource).toBe("picker");
  });

  it("a small city from the full directory beats the picker (incident 2026-10-09)", () => {
    // بناب was never in the ~90-city picker — the user hacked it in as a
    // «باید» chip while the hunt ran in Tehran. Text detection now covers
    // all 1177 Divar cities, so the text wins and the chip hack is unneeded.
    const def = resolveHuntDefinition(
      body({ query: "برنج هندی در بناب", city: "tehran" })
    )!;
    expect(def.city).toBe("bonab");
    expect(def.citySource).toBe("text");
  });

  it("applies the text category when the picker is all (flaw #10)", () => {
    const def = resolveHuntDefinition(
      body({ query: "آپارتمان نوساز سعادت آباد" })
    )!;
    expect(def.category).toBe("real-estate");
  });

  it("keeps an explicit category over the text", () => {
    const def = resolveHuntDefinition(
      body({ query: "آپارتمان نوساز سعادت آباد", category: "vehicles" })
    )!;
    expect(def.category).toBe("vehicles");
  });

  it("detects the piano category from text (music)", () => {
    expect(resolveHuntDefinition(body())!.category).toBe("music");
  });

  it("honors a dismissed city reading — but keeps the content terms", () => {
    const def = resolveHuntDefinition(body({ dismissed: ["city:tehran"] }))!;
    expect(def.city).toBe("all");
    expect(def.include).toContain("پیانو");
  });

  it("extracts price bounds from text without leaking them into terms", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی زیر ۲۰۰ میلیون" }))!;
    expect(def.priceMax).toBe("200000000");
    expect(def.include).toContain("گوشی");
    expect(def.include).not.toContain("۲۰۰");
    expect(def.include).not.toContain("میلیون");
    expect(def.include).not.toContain("تا");
  });

  it("applies inline «نه» excludes without keeping the cue word", () => {
    const def = resolveHuntDefinition(body({ query: "پیانو نه دیجیتال" }))!;
    expect(def.exclude).toContain("دیجیتال");
    expect(def.include).toContain("پیانو");
    expect(def.include).not.toContain("نه");
  });

  it("does not invent terms for an empty query", () => {
    expect(resolveHuntDefinition(body({ query: "" }))).toBeNull();
    expect(resolveHuntDefinition(body({ query: "   " }))).toBeNull();
  });

  it("a city-only query yields no content terms (honest city browse)", () => {
    const def = resolveHuntDefinition(body({ query: "تهران" }))!;
    expect(def.include).toEqual([]);
    expect(def.city).toBe("tehran");
  });

  it("merges with explicit include chips without duplicating", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو یاماها", include: ["یاماها"] })
    )!;
    expect(def.include.filter((t) => t === "یاماها")).toHaveLength(1);
    expect(def.include).toContain("پیانو");
  });
});

describe("resolveHuntDefinition — SHOULD bucket (flaw #19, 2026-10-09)", () => {
  it("maps «ترجیحاً» wishes to should (ranking-only)", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی ترجیحاً تمیز" }))!;
    expect(def.should).toContain("تمیز");
    expect(def.include).toContain("گوشی");
    expect(def.include).not.toContain("تمیز");
    expect(def.include).not.toContain("ترجیحاً");
  });

  it("dedupes should against include chips", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو ترجیحاً تمیز", include: ["تمیز"] })
    )!;
    expect(def.should).not.toContain("تمیز");
    expect(def.include).toContain("تمیز");
  });

  it("dedupes should against exclude terms", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو ترجیحاً کهنه", exclude: ["کهنه"] })
    )!;
    expect(def.should).not.toContain("کهنه");
  });

  it("defaults should to [] when there are no preferences", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.should).toEqual([]);
  });
});

describe("parsePriceBound", () => {  it("parses digits-only and Persian digits", () => {
    expect(parsePriceBound("200000000")).toBe(200000000);
    expect(parsePriceBound("۲۰۰")).toBe(200);
  });

  it("rejects garbage and zero", () => {
    expect(parsePriceBound("")).toBeNull();
    expect(parsePriceBound("abc")).toBeNull();
    expect(parsePriceBound("0")).toBeNull();
  });
});

describe("HANDOFF-2 — resolveHuntDefinition negation intake", () => {
  it("J1: exclude = {کرکره، تور ساده}, should carries no negated word", () => {
    const def = resolveHuntDefinition(body({ query: "پرده آماده یا سفارشی برای پنجره پذیرایی، پارچه‌ای ضخیم، نه کرکره و نه تور ساده" }))!;
    expect(def.exclude).toContain("کرکره");
    expect(def.exclude).toContain("تور ساده");
    expect(def.exclude).not.toContain("کرکره و");
    expect(def.should).toEqual(["پنجره پذیرایی پارچه ای ضخیم"]);
    expect(def.should.join(" ")).not.toContain("کرکره");
    expect(def.should.join(" ")).not.toContain("تور");
  });
  it("J2: exclude = {هندزفری سیم‌دار ارزان}", () => {
    const def = resolveHuntDefinition(body({ query: "هدفون بی‌سیم سونی یا جی‌بی‌ال با نویزکنسلینگ، سالم با باکس، نه هندزفری سیم‌دار ارزان" }))!;
    expect(def.exclude).toContain("هندزفری سیم‌دار ارزان");
    expect(def.should).toEqual([]);
  });
  it("J3: exclude = {دوچرخه بچه‌گانه، برقی}, no «ترجیحا» in any exclude", () => {
    const def = resolveHuntDefinition(body({ query: "دوچرخه کوهستان ۲۶ اینچ، دنده شیمانو، نه دوچرخه بچه‌گانه و نه برقی، ترجیحاً تهران زیر ۱۵ میلیون" }))!;
    expect(def.exclude).toContain("دوچرخه بچه‌گانه");
    expect(def.exclude).toContain("برقی");
    expect(def.exclude.every((t) => !t.includes("ترجیحا"))).toBe(true);
  });
  it("«میز نهارخوری چوبی» → no exclude", () => {
    const def = resolveHuntDefinition(body({ query: "میز نهارخوری چوبی" }))!;
    expect(def.exclude).toEqual([]);
  });
  it("«پرده، نه کرکره یا تور» → {کرکره، تور}", () => {
    const def = resolveHuntDefinition(body({ query: "پرده، نه کرکره یا تور" }))!;
    expect(def.exclude).toContain("کرکره");
    expect(def.exclude).toContain("تور");
    expect(def.exclude).toHaveLength(2);
  });
  it("«گوشی سامسونگ، نه آیفون، سالم» → {آیفون}", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی سامسونگ، نه آیفون، سالم" }))!;
    expect(def.exclude).toEqual(["آیفون"]);
  });
  it("a sentence without «نه» keeps today's output exactly", () => {
    const def = resolveHuntDefinition(body({ query: "پرده آماده برای پنجره" }))!;
    expect(def.include).toEqual(["پرده", "آماده"]);
    expect(def.exclude).toEqual([]);
    expect(def.should).toEqual(["پنجره"]);
  });
});

describe("HANDOFF-4 — resolveHuntDefinition suffix negation and typo price", () => {
  it("telescope: exclude {چینی}, include without چینی/نباشه/۸/میلون, preferred price 8000000 (HANDOFF-5: hard priceMax is now empty), no lone زیر in should", () => {
    const def = resolveHuntDefinition(body({ query: "تلسکوپ نجومی حتماً پایه دار چینی نباشه ترجیحاً زیر ۸ میلون" }))!;
    expect(def.exclude).toEqual(["چینی"]);
    expect(def.include).toEqual(["تلسکوپ", "نجومی", "پایه", "دار"]);
    expect(def.priceMax).toBe("");
    expect(def.preferredPriceMax).toBe("8000000");
    expect(def.should).not.toContain("زیر");
    expect(def.should.join(" ")).not.toContain("۸");
    expect(def.should.join(" ")).not.toContain("میلون");
  });
  it("phone: exclude {دست دوم}, include without دوم/نباشه, بدون absent as today", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی سامسونگ بدون خط و خش، دست دوم نباشه" }))!;
    expect(def.exclude).toEqual(["دست دوم"]);
    expect(def.include).toEqual(["گوشی", "سامسونگ"]);
    expect(def.absentAttributes).toEqual(["خط و خش دست"]);
  });
  it("laptop / phone / bike / handsfree / table: hard suffix excludes, head kept", () => {
    const laptop = resolveHuntDefinition(body({ query: "لپ‌تاپ ایسوس، استوک نباشه" }))!;
    expect(laptop.exclude).toEqual(["استوک"]);
    expect(laptop.include).toEqual(["لپ", "تاپ", "ایسوس"]);
    const phone = resolveHuntDefinition(body({ query: "گوشی، آیفون نباشه" }))!;
    expect(phone.exclude).toEqual(["آیفون"]);
    expect(phone.include).toEqual(["گوشی"]);
    const bike = resolveHuntDefinition(body({ query: "دوچرخه کوهستان، دوچرخه برقی نباشه" }))!;
    expect(bike.exclude).toEqual(["برقی"]);
    expect(bike.include).toEqual(["دوچرخه"]);
    const handsfree = resolveHuntDefinition(body({ query: "هندزفری، سیم دار نباشه" }))!;
    expect(handsfree.exclude).toEqual(["سیم دار"]);
    expect(handsfree.include).toEqual(["هندزفری"]);
    const table = resolveHuntDefinition(body({ query: "میز نهارخوری، شیشه‌ای نباشه" }))!;
    expect(table.exclude).toEqual(["شیشه‌ای"]);
    expect(table.include).toEqual(["میز", "نهارخوری"]);
  });
  it("«نداشته باشه» is soft: no exclude, absent {خط و خش}, words leave include", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی سامسونگ، خط و خش نداشته باشه" }))!;
    expect(def.exclude).toEqual([]);
    expect(def.absentAttributes).toEqual(["خط و خش"]);
    expect(def.include).toEqual(["گوشی", "سامسونگ"]);
  });
  it("double negation: «بدون گارانتی نباشه» leaves گارانتی inert", () => {
    const def = resolveHuntDefinition(body({ query: "یخچال ساید بای ساید، بدون گارانتی نباشه" }))!;
    expect(def.exclude).not.toContain("گارانتی");
    expect(def.absentAttributes).not.toContain("گارانتی");
    expect(def.include).not.toContain("گارانتی");
  });
  it("«تابلو فرش نیستان» makes no exclude", () => {
    const def = resolveHuntDefinition(body({ query: "تابلو فرش نیستان" }))!;
    expect(def.exclude).toEqual([]);
  });
  it("typo prices: 10 ملیون → 10000000, 130 ملییون → 130000000, 20 میل → 20000000, model ۱۵ kept", () => {
    const a = resolveHuntDefinition(body({ query: "گوشی سامسونگ زیر ۱۰ ملیون" }))!;
    expect(a.priceMax).toBe("10000000");
    expect(a.include).toEqual(["گوشی", "سامسونگ"]);
    const b = resolveHuntDefinition(body({ query: "آیفون ۱۵ پرو تا ۱۳۰ ملییون" }))!;
    expect(b.priceMax).toBe("130000000");
    expect(b.include).toEqual(["آیفون", "۱۵", "پرو"]);
    const c = resolveHuntDefinition(body({ query: "ماشین لباسشویی تا ۲۰ میل" }))!;
    expect(c.priceMax).toBe("20000000");
    expect(c.include).toEqual(["ماشین", "لباسشویی"]);
  });
  it("«میل لنگ پراید» has no price and keeps میل in include", () => {
    const def = resolveHuntDefinition(body({ query: "میل لنگ پراید" }))!;
    expect(def.priceMax).toBe("");
    expect(def.include).toContain("میل");
  });
  it("«نه X» from HANDOFF-2 is untouched", () => {
    const def = resolveHuntDefinition(body({ query: "عینک آفتابی ری‌بن اصل حتماً نه دست دوم نه فیک ترجیحاً تهران" }))!;
    expect(def.exclude).toEqual(["دست دوم", "فیک"]);
    expect(def.include).toEqual(["عینک", "آفتابی", "ری", "اصل"]);
  });
});

describe("HANDOFF-5 — numeric intake: money-only price, soft preferred price and year, drop function words", () => {
  it("apartment range: 8 billion hard cap, range phrase to should, no range/function tokens in include", () => {
    const def = resolveHuntDefinition(body({ query: "آپارتمان ۸۰ تا ۱۰۰ متری در سعادت‌آباد، آسانسور حتماً، طبقه اول نباشه، تا ۸ میلیارد" }))!;
    expect(def.priceMax).toBe("8000000000");
    expect(def.priceMin).toBe("");
    expect(def.exclude).toEqual(["طبقه اول"]);
    expect(def.include).toEqual(["آپارتمان", "سعادت", "آباد", "آسانسور"]);
    expect(def.should).toContain("۸۰ تا ۱۰۰ متری");
  });
  it("«رم حداقل ۱۶» is not a price: no bound, ۱۶ out of include, expression in should", () => {
    const def = resolveHuntDefinition(body({ query: "لپ‌تاپ ایسوس رم حداقل ۱۶" }))!;
    expect(def.priceMin).toBe("");
    expect(def.priceMax).toBe("");
    expect(def.include).not.toContain("۱۶");
    expect(def.should).toContain("حداقل ۱۶");
  });
  it("«رم ۱۶ گیگ»: no price, ۱۶ stays in include, گیگ moves to should", () => {
    const def = resolveHuntDefinition(body({ query: "لپ‌تاپ ایسوس رم ۱۶ گیگ" }))!;
    expect(def.priceMin).toBe("");
    expect(def.priceMax).toBe("");
    expect(def.include).toContain("۱۶");
    expect(def.include).not.toContain("گیگ");
    expect(def.should).toContain("گیگ");
  });
  it("«مدل ۱۴۰۱ به بالا»: yearMin 1401, مدل/۱۴۰۱/به/بالا out of include", () => {
    const def = resolveHuntDefinition(body({ query: "پژو ۲۰۶ مدل ۱۴۰۱ به بالا" }))!;
    expect(def.yearMin).toBe(1401);
    expect(def.include).toEqual(["پژو", "۲۰۶"]);
  });
  it("«مدل ۹۸» alone keeps ۹۸ in include and sets no year", () => {
    const def = resolveHuntDefinition(body({ query: "پژو ۲۰۶ مدل ۹۸" }))!;
    expect(def.yearMin).toBeNull();
    expect(def.include).toContain("۹۸");
  });
  it("two-digit year floor converts: «مدل ۹۸ به بالا» → 1398; «از ۱۴۰۰ به بعد» → 1400; out-of-range year sets nothing", () => {
    expect(resolveHuntDefinition(body({ query: "پژو ۲۰۶ مدل ۹۸ به بالا" }))!.yearMin).toBe(1398);
    expect(resolveHuntDefinition(body({ query: "پژو ۲۰۶ از ۱۴۰۰ به بعد" }))!.yearMin).toBe(1400);
    expect(resolveHuntDefinition(body({ query: "پژو ۲۰۶ مدل ۱۵۰۰ به بالا" }))!.yearMin).toBeNull();
  });
  it("bike: preferred 15M, city untouched, ۲۶ stays, اینچ to should", () => {
    const def = resolveHuntDefinition(body({ query: "دوچرخه کوهستان ۲۶ اینچ، ترجیحاً تهران زیر ۱۵ میلیون" }))!;
    expect(def.priceMax).toBe("");
    expect(def.preferredPriceMax).toBe("15000000");
    expect(def.city).toBe("tehran");
    expect(def.include).toContain("۲۶");
    expect(def.include).not.toContain("اینچ");
    expect(def.should).toContain("اینچ");
  });
  it("preferred min: «ترجیحاً بالای ۵ میلیون» is soft only", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی ترجیحاً بالای ۵ میلیون" }))!;
    expect(def.priceMin).toBe("");
    expect(def.preferredPriceMin).toBe("5000000");
  });
  it("hard and preferred coexist: preferred price plus a later hard cap", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی ترجیحاً زیر ۸ میلیون، تا ۲۰ میلیون" }))!;
    expect(def.preferredPriceMax).toBe("8000000");
    expect(def.priceMax).toBe("20000000");
  });
  it("bare numbers stay: «آیفون ۱۳» keeps ۱۳; «میز ۶ نفره» keeps ۶, نفره to should", () => {
    expect(resolveHuntDefinition(body({ query: "آیفون ۱۳" }))!.include).toContain("۱۳");
    const table = resolveHuntDefinition(body({ query: "میز ناهارخوری ۶ نفره" }))!;
    expect(table.include).toContain("۶");
    expect(table.include).not.toContain("نفره");
    expect(table.should).toContain("نفره");
    expect(table.priceMax).toBe("");
  });
  it("function words never enter include, but «یک» keeps its meaning", () => {
    expect(resolveHuntDefinition(body({ query: "آپارتمان یک خوابه" }))!.include).toContain("یک");
    const phone = resolveHuntDefinition(body({ query: "یه گوشی سامسونگ در حد نو" }))!;
    expect(phone.include).not.toContain("یه");
    expect(phone.include).not.toContain("در");
    expect(phone.include).toContain("گوشی");
  });
  it("untouched anchors: «تابلو فرش نیستان» and the ری‌بن excludes", () => {
    const t = resolveHuntDefinition(body({ query: "تابلو فرش نیستان" }))!;
    expect(t.exclude).toEqual([]);
    expect(t.include).toContain("نیستان");
    const r = resolveHuntDefinition(body({ query: "عینک آفتابی ری‌بن اصل حتماً نه دست دوم نه فیک ترجیحاً تهران" }))!;
    expect(r.exclude).toEqual(["دست دوم", "فیک"]);
  });
});
