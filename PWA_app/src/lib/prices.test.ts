import { describe, expect, it } from "vitest";
import { faDigitsToEn, formatPriceToman, parsePriceInput } from "@/lib/prices";

describe("prices", () => {
  it("converts Persian and Arabic digits", () => {
    expect(faDigitsToEn("۲۰۰")).toBe("200");
    expect(faDigitsToEn("٢٠٠")).toBe("200");
    expect(faDigitsToEn("200")).toBe("200");
  });

  it("parses grouped Persian input", () => {
    expect(parsePriceInput("۲۰۰٬۰۰۰٬۰۰۰")).toBe(200000000);
    expect(parsePriceInput("200,000,000")).toBe(200000000);
    expect(parsePriceInput("  ۱۵۰۰۰۰ ")).toBe(150000);
  });

  it("parses unit suffixes so users avoid typing zeros", () => {
    expect(parsePriceInput("۱۸۵ میلیون")).toBe(185000000);
    expect(parsePriceInput("200 میلیون")).toBe(200000000);
    expect(parsePriceInput("۲ میلیارد")).toBe(2000000000);
    expect(parsePriceInput("۵۰۰ هزار")).toBe(500000);
    expect(parsePriceInput("۱۸۵٬۰۰۰٬۰۰۰ تومان")).toBe(185000000);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("   ")).toBeNull();
    expect(parsePriceInput("توافقی")).toBeNull();
  });

  it("formats with Persian grouping or explicit unknown", () => {
    expect(formatPriceToman(185000000)).toBe("۱۸۵٬۰۰۰٬۰۰۰ تومان");
    expect(formatPriceToman(null)).toBe("نامشخص");
  });
});
