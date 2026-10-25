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
    expect(r.mismatch).toBe(false);
  });
});
