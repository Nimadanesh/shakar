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

/** Compact Persian display for rows: 20000000 → «۲۰ میلیون». */
export function formatPriceCompact(value: number | null): string {
  if (value === null) return "نامشخص";
  const fa = (n: number) =>
    (Math.round(n * 100) / 100).toLocaleString("fa-IR", {
      maximumFractionDigits: 2,
    });
  if (value >= 1_000_000_000) return `${fa(value / 1_000_000_000)} میلیارد`;
  if (value >= 1_000_000) return `${fa(value / 1_000_000)} میلیون`;
  if (value >= 1_000) return `${fa(value / 1_000)} هزار`;
  return `${fa(value)} تومان`;
}

const FA_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const FA_TEENS = [
  "ده",
  "یازده",
  "دوازده",
  "سیزده",
  "چهارده",
  "پانزده",
  "شانزده",
  "هفده",
  "هجده",
  "نوزده",
];
const FA_TENS = [
  "",
  "",
  "بیست",
  "سی",
  "چهل",
  "پنجاه",
  "شصت",
  "هفتاد",
  "هشتاد",
  "نود",
];
const FA_HUNDREDS = [
  "",
  "یکصد",
  "دویست",
  "سیصد",
  "چهارصد",
  "پانصد",
  "ششصد",
  "هفتصد",
  "هشتصد",
  "نهصد",
];

function wordsUnderThousand(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(FA_HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(FA_TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t > 0) parts.push(FA_TENS[t]);
    if (o > 0) parts.push(FA_ONES[o]);
  }
  return parts.join(" و ");
}

/**
 * The amount in Persian words: 20000000 → «بیست میلیون».
 * Used under the digits-only price inputs so the user sees — and trusts —
 * what they typed.
 */
export function formatPriceWords(value: number | null): string | null {
  if (value === null) return null;
  if (value === 0) return "صفر";
  const scales: Array<[number, string]> = [
    [1_000_000_000, "میلیارد"],
    [1_000_000, "میلیون"],
    [1_000, "هزار"],
  ];
  const parts: string[] = [];
  let rest = value;
  for (const [scale, name] of scales) {
    if (rest >= scale) {
      const count = Math.floor(rest / scale);
      parts.push(`${wordsUnderThousand(count)} ${name}`);
      rest = rest % scale;
    }
  }
  if (rest > 0) parts.push(wordsUnderThousand(rest));
  return parts.join(" و ");
}
