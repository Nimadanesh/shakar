import { normalizePersian } from "@/lib/normalizePersian";

const MAX_KEYWORDS = 20;

/** Split raw include/exclude input on whitespace/commas, normalize, drop empties, cap at 20. */
export function parseKeywords(raw: string): string[] {
  const terms = raw
    .split(/[\s،,]+/)
    .map((t) => normalizePersian(t))
    .filter((t) => t.length > 0);
  return [...new Set(terms)].slice(0, MAX_KEYWORDS);
}

/** Normalize a single chip term (spaces inside the term are preserved). Returns "" when blank. */
export function normalizeKeyword(raw: string): string {
  return normalizePersian(raw);
}

export interface SearchFilterParams {
  query: string;
  category: string;
  city: string;
  priceMin: string;
  priceMax: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  hasImage: boolean;
}

export function validateSearchFilters(params: SearchFilterParams): string | null {
  const min = Number(params.priceMin);
  const max = Number(params.priceMax);
  if (params.priceMin !== "" && (Number.isNaN(min) || min < 0)) {
    return "کف قیمت معتبر نیست";
  }
  if (params.priceMax !== "" && (Number.isNaN(max) || max < 0)) {
    return "سقف قیمت معتبر نیست";
  }
  if (params.priceMin !== "" && params.priceMax !== "" && min > max) {
    return "کف قیمت از سقف بیشتر است";
  }
  return null;
}
