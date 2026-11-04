import { describe, expect, it } from "vitest";

import { maskThousandNumbers, unitFamilyOf, type UnitFamily } from "./unitClasses";

// HANDOFF-4e1 compatibility test (ا-۶): every word of SPEC_UNITS,
// MONEY_UNITS (definition.ts, function-local — mirrored here as
// literals with path:line), UNITS and PRICE_WORDS (contract.ts) and
// MM3C_UNIT_WORDS (semantics.ts) has a family in unitClasses.ts.
// The full word ← family table IS this file's EXPECTED map below.
const EXPECTED: Record<string, UnitFamily> = {
  // MONEY_UNITS (definition.ts:489)
  میلیارد: "money",
  میلیون: "money",
  میلون: "money",
  ملیون: "money",
  ملییون: "money",
  ملیارد: "money",
  میل: "money",
  هزار: "money",
  تومان: "money",
  تومن: "money",
  ت: "money",
  // SPEC_UNITS (definition.ts:493)
  متر: "area",
  متری: "area",
  گیگ: "storage",
  گیگابایت: "storage",
  مگ: "spec-other",
  مگابایت: "spec-other",
  ترابایت: "storage",
  اینچ: "inch",
  لیتر: "spec-other",
  وات: "spec-other",
  "سی‌سی": "spec-other",
  سیسی: "spec-other",
  کیلو: "spec-other",
  نفره: "people",
  ساله: "time",
  // UNITS (contract.ts:74)
  // (گیگ، گیگابایت، مگ، مگابایت، ترابایت، اینچ، لیتر، وات، سی‌سی، سیسی — already above)
  // PRICE_WORDS (contract.ts:86)
  // (میلیون، میلیارد، تومان، هزار — already above)
  // MM3C_UNIT_WORDS (semantics.ts:2300)
  ماه: "time",
  ماهه: "time",
  روز: "time",
  روزه: "time",
  هفته: "time",
  سال: "time",
  ساعت: "time",
  ترا: "storage",
  gb: "storage",
  tb: "storage",
  مگاپیکسل: "camera",
  درصد: "percent",
  عدد: "count",
  تا: "range",
  دسته: "count",
  بازی: "count",
  // Architect's explicit words outside the four lists
  تومانی: "money",
  ریال: "money",
  میلیونی: "money",
  دقیقه: "time",
  عددی: "count",
  کیلومتر: "distance",
  km: "distance",
  اینچی: "inch",
  نفر: "people",
  خوابه: "rooms",
  خواب: "rooms",
};

describe("unitClasses compatibility (HANDOFF-4e1, ا-۶)", () => {
  it("every listed word has its family", () => {
    for (const [word, family] of Object.entries(EXPECTED)) {
      expect(unitFamilyOf(word)).toBe(family);
    }
  });

  it("all 28 MM3C_UNIT_WORDS have a family (stop condition)", () => {
    const mm3c = [
      "میلیون", "ملیون", "میلیارد", "ملیارد", "تومان", "تومن", "هزار",
      "ماه", "ماهه", "روز", "روزه", "هفته", "سال", "ساله", "ساعت",
      "گیگ", "گیگابایت", "ترابایت", "ترا", "gb", "tb", "مگاپیکسل",
      "اینچ", "درصد", "عدد", "تا", "دسته", "بازی",
    ];
    expect(mm3c).toHaveLength(28);
    for (const word of mm3c) {
      expect(unitFamilyOf(word)).not.toBeNull();
    }
  });

  it("non-unit words have no family", () => {
    for (const word of ["پرو", "مکس", "تمیز", "تیپ", "صندوقدار", "دیجیتال", "موجود"]) {
      expect(unitFamilyOf(word)).toBeNull();
    }
  });
});

describe("maskThousandNumbers (HANDOFF-4e1, ا-۲)", () => {
  it("masks thousand numbers, keeps two model codes and non-thousand commas", () => {
    expect(maskThousandNumbers("پراید ۱۳۱ کارکرد ۱۳۲,۰۰۰ کیلومتر")).toContain("zzthousandzz");
    expect(maskThousandNumbers("پراید ۱۳۱ کارکرد ۱۳۲,۰۰۰ کیلومتر")).not.toContain("۱۳۲");
    expect(maskThousandNumbers("۱۵,۰۰۰,۰۰۰ تومان")).toContain("zzthousandzz");
    expect(maskThousandNumbers("۱۳۲٬۰۰۰ کیلومتر")).toContain("zzthousandzz");
    expect(maskThousandNumbers("۱۳۲,۵۰۰ تومان")).toContain("zzthousandzz");
    expect(maskThousandNumbers("پژو ۲۰۷,۲۰۶ تمیز")).toBe("پژو ۲۰۷,۲۰۶ تمیز");
    expect(maskThousandNumbers("پراید ۱۳۱ کارکرد ۱۳۲,۲۵۰ کیلومتر")).toBe("پراید ۱۳۱ کارکرد ۱۳۲,۲۵۰ کیلومتر");
    expect(maskThousandNumbers("آیفون ۱۴ پرو")).toBe("آیفون ۱۴ پرو");
  });
});
