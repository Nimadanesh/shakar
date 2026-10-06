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

  it("does not match a city inside another word (word boundaries)", () => {
    // «درشت» contains «رشت» — must not infer Rasht.
    expect(ids("ماهی درشت")).not.toContain("city:rasht");
    expect(ids("ماهی درشت")).not.toContainEqual(
      expect.stringMatching(/^city:/)
    );
  });

  it("detects بدون exclusion", () => {
    const { applied } = interpretQuery("مبل راحتی بدون لکه");
    expect(applied.map((c) => c.id)).toContain("exclude:لکه");
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
});

describe("detectTransaction", () => {
  it("returns null without transaction words", async () => {
    const { detectTransaction } = await import("@/lib/interpret");
    expect(detectTransaction("خونه ۵۰ متری")).toBeNull();
    expect(detectTransaction("پیانو")).toBeNull();
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
