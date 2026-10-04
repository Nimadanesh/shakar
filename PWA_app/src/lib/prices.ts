import { normalizePersian } from "@/lib/normalizePersian";

// Price input helpers: localized display stays separate from the numeric model.

/** Persian + Arabic-Indic digits → English digits (no other normalization). */
export function faDigitsToEn(input: string): string {
  return normalizePersian(input).replace(/[۰-۹]/g, (d) =>
    String(d.charCodeAt(0) - 0x06f0)
  );
}

/**
 * Parse a price field into a plain toman number. Understands Persian/Arabic
 * digits, grouping separators, and unit suffixes (هزار/میلیون/میلیارد/تومان)
 * so users never type raw zeros. Null = empty/unbounded. NaN-safe.
 */
export function parsePriceInput(raw: string): number | null {
  const cleaned = faDigitsToEn(raw).replace(/[,\s٬،]/g, "");
  if (cleaned === "") return null;
  let factor = 1;
  let digits = cleaned;
  const unitMatch = cleaned.match(/^(.*?)(میلیارد|میلیون|هزار|تومان|ت)$/);
  if (unitMatch) {
    digits = unitMatch[1];
    factor =
      unitMatch[2] === "میلیارد"
        ? 1_000_000_000
        : unitMatch[2] === "میلیون"
          ? 1_000_000
          : unitMatch[2] === "هزار"
            ? 1_000
            : 1;
  }
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits) * factor;
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/** Display a toman value with Persian grouping, or an explicit unknown state. */
export function formatPriceToman(value: number | null): string {
  if (value === null) return "نامشخص";
  return `${value.toLocaleString("fa-IR")} تومان`;
}
