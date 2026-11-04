import "server-only";

import { normalizeForMatch } from "@/lib/persianNormalize";

// HANDOFF-4e1 (2026-11-04) — unit-word families for number evidence.
// دانش عمومی زبان؛ نه از تیترهای مجموعه‌های طلایی یا بیرونی.
// The single place for unit words in this work. Keys are normalized
// with normalizeForMatch at load (so «آیفون»/«ایفون»-style variants
// collapse the same way the engine's own tables do); Latin is folded
// to lowercase on lookup.

export type UnitFamily =
  | "money"
  | "time"
  | "count"
  | "range"
  | "distance"
  | "percent"
  | "storage"
  | "inch"
  | "camera"
  | "people"
  | "rooms"
  | "area"
  | "spec-other";

/** Role families: a number followed by one is a price, duration, count, distance or percent — never a model code or a spec value. */
export const ROLE_FAMILIES: ReadonlySet<UnitFamily> = new Set([
  "money",
  "time",
  "count",
  "distance",
  "percent",
]);

/** Spec families: a number followed by one is a specification value. */
export const SPEC_FAMILIES: ReadonlySet<UnitFamily> = new Set([
  "storage",
  "inch",
  "camera",
  "people",
  "rooms",
  "area",
  "spec-other",
]);

const WORD_FAMILY_PAIRS: ReadonlyArray<readonly [string, UnitFamily]> = [
  // money (incl. MONEY_UNITS spelling variants میلون، ملییون، ت)
  ["تومان", "money"],
  ["تومن", "money"],
  ["تومانی", "money"],
  ["ریال", "money"],
  ["هزار", "money"],
  ["میلیون", "money"],
  ["ملیون", "money"],
  ["میلیونی", "money"],
  ["میلیارد", "money"],
  ["ملیارد", "money"],
  ["میل", "money"],
  ["میلون", "money"],
  ["ملییون", "money"],
  ["ت", "money"],
  // time
  ["ماه", "time"],
  ["ماهه", "time"],
  ["روز", "time"],
  ["روزه", "time"],
  ["هفته", "time"],
  ["سال", "time"],
  ["ساله", "time"],
  ["ساعت", "time"],
  ["دقیقه", "time"],
  // count
  ["عدد", "count"],
  ["عددی", "count"],
  ["دسته", "count"],
  ["بازی", "count"],
  // range (only for the model code reader's condition 1 and NE1's range rule — never drops a code in NE2)
  ["تا", "range"],
  // distance
  ["کیلومتر", "distance"],
  ["km", "distance"],
  // percent
  ["درصد", "percent"],
  // storage
  ["گیگ", "storage"],
  ["گیگابایت", "storage"],
  ["ترابایت", "storage"],
  ["ترا", "storage"],
  ["gb", "storage"],
  ["tb", "storage"],
  // inch
  ["اینچ", "inch"],
  ["اینچی", "inch"],
  // camera
  ["مگاپیکسل", "camera"],
  // people
  ["نفره", "people"],
  ["نفر", "people"],
  // rooms
  ["خوابه", "rooms"],
  ["خواب", "rooms"],
  // area
  ["متر", "area"],
  ["متری", "area"],
  // spec-other: SPEC_UNITS words not covered above
  ["مگ", "spec-other"],
  ["مگابایت", "spec-other"],
  ["لیتر", "spec-other"],
  ["وات", "spec-other"],
  ["سی‌سی", "spec-other"],
  ["سیسی", "spec-other"],
  ["کیلو", "spec-other"],
];

const foldLatinToken = (tok: string): string =>
  /[a-zA-Z]/.test(tok) ? tok.toLowerCase() : tok;

const UNIT_WORD_FAMILY: ReadonlyMap<string, UnitFamily> = new Map(
  WORD_FAMILY_PAIRS.map(([word, family]) => [
    normalizeForMatch(word),
    family,
  ] as const)
);

/** Family of a (possibly unnormalized) word, or null when it is not a unit word. */
export function unitFamilyOf(word: string): UnitFamily | null {
  return UNIT_WORD_FAMILY.get(foldLatinToken(normalizeForMatch(word))) ?? null;
}

// Thousand numbers (ا-۲): digit groups joined by «,» or «٬» (never «،»),
// no spaces around the separator, first group 1–3 digits, the rest
// exactly 3 digits each. Counts as one number only with at least two
// separators (۱۵,۰۰۰,۰۰۰) or a last group of digit + two zeros
// (۱۳۲,۰۰۰، ۱۳۲,۵۰۰). «۲۰۷,۲۰۶» (two model codes) is NOT one.
const THOUSAND_GUARD = "zzthousandzz";
const DIGIT_CHARS = "0-9۰-۹٠-٩";
const THOUSAND_PATTERN = new RegExp(
  `[${DIGIT_CHARS}]{1,3}(?:[,٬][${DIGIT_CHARS}]{3})+`,
  "g"
);
const IS_DIGIT = new RegExp(`^[${DIGIT_CHARS}]$`);
const LAST_GROUP_THOUSAND = new RegExp(`^[${DIGIT_CHARS}][0۰٠][0۰٠]$`);

/**
 * Replace thousand numbers in raw text with a guard token, before
 * normalizeForMatch (which turns commas into spaces). No piece of a
 * thousand number survives as an independent number token.
 */
export function maskThousandNumbers(raw: string): string {
  let out = "";
  let last = 0;
  for (const m of raw.matchAll(THOUSAND_PATTERN)) {
    const text = m[0];
    const idx = m.index ?? 0;
    // Not part of a longer digit run.
    const before = idx > 0 ? raw[idx - 1] : "";
    const after = idx + text.length < raw.length ? raw[idx + text.length] : "";
    if ((before !== "" && IS_DIGIT.test(before)) || (after !== "" && IS_DIGIT.test(after))) {
      continue;
    }
    const groups = text.split(/[,٬]/);
    const isThousand =
      groups.length - 1 >= 2 || LAST_GROUP_THOUSAND.test(groups[groups.length - 1]);
    if (!isThousand) continue;
    out += raw.slice(last, idx) + ` ${THOUSAND_GUARD} `;
    last = idx + text.length;
  }
  return out + raw.slice(last);
}
