import type { FixtureAd } from "@/data/search-fixtures";
import { normalizePersian } from "@/lib/normalizePersian";
import type {
  AdEvidence,
  MatchReason,
  MatchResult,
  PriceState,
  SearchContext,
  SearchOutcome,
  SuppressedAd,
} from "@/types/search";

export function adSearchText(ad: { title: string; description: string }): string {
  return normalizePersian(`${ad.title} ${ad.description}`);
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Terms wrapped in double quotes ("U3") match as exact phrases: the phrase
 * must appear with non-letter boundaries on both sides. Unquoted terms keep
 * the default substring behavior. Quotes are UI-level intent markers, never
 * part of the matched text.
 */
export function stripQuotes(term: string): { phrase: string; exact: boolean } {
  const normalized = normalizePersian(term).trim();
  if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
    return { phrase: normalized.slice(1, -1).trim(), exact: true };
  }
  return { phrase: normalized, exact: false };
}

export function includesTerm(haystack: string, rawTerm: string): boolean {
  const { phrase, exact } = stripQuotes(rawTerm);
  if (phrase === "") return false;
  if (!exact) return haystack.includes(phrase);
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(phrase)}(?=[^\\p{L}\\p{N}_]|$)`,
    "u"
  );
  return pattern.test(haystack);
}

const QUERY_STOPWORDS = new Set(
  [
    "میخوام",
    "میخواهم",
    "می‌خوام",
    "می‌خواهم",
    "باشه",
    "باشد",
    "خوب",
    "خوبه",
    "و",
    "در",
    "به",
    "از",
    "با",
    "برای",
    "که",
    "این",
    "آن",
    "را",
    "یک",
    "یه",
    "نه",
    "نمیخوام",
    "نمی‌خوام",
    "نمیخواهم",
    "نمی‌خواهم",
    "نمیخواد",
    "نمی‌خواد",
    "ترجیحا",
    "ترجیحاً",
    "زیر",
    "تا",
    "بالای",
    "حداقل",
    "حداکثر",
    "کمتر",
    "بیشتر",
    "بدون",
    "بجز",
    "به‌جز",
  ].map((w) => normalizePersian(w))
);

/**
 * Significant raw-query terms for local retrieval (stand-in for backend
 * query matching). Stopwords and already-excluded terms are dropped; a
 * candidate must contain at least one remaining term. Preferences are never
 * dropped here (they must not filter) — absence becomes ؟ evidence instead.
 * Duplicates are kept so multi-word phrases stay intact in display use.
 */
export function queryContentTerms(rawQuery: string, excludeTerms: string[]): string[] {
  const excluded = new Set(excludeTerms.map((t) => normalizePersian(t)));
  const terms: string[] = [];
  for (const word of normalizePersian(rawQuery).split(/[\s،,.!؟?]+/)) {
    const term = word.trim();
    if (term === "" || term.length < 2) continue;
    if (QUERY_STOPWORDS.has(term)) continue;
    if (excluded.has(term)) continue;
    terms.push(term);
  }
  return terms;
}

/**
 * Original user-typed spelling of normalized terms (Latin case, Arabic
 * variants) for display surfaces. Falls back to the normalized term when the
 * original form cannot be located.
 */
export function displayTerms(rawQuery: string, terms: string[]): string[] {
  const lower = rawQuery.toLowerCase();
  return terms.map((term) => {
    const at = lower.indexOf(term);
    return at >= 0 ? rawQuery.slice(at, at + term.length) : term;
  });
}

export interface ExcerptSegment {
  text: string;
  hit: boolean;
}

/** Seller-faithful excerpt (~90 chars) around the first include-term hit, with hit ranges marked. */
export function excerptSegments(source: string, terms: string[]): ExcerptSegment[] {
  const normalizedTerms = terms.map((t) => stripQuotes(t).phrase).filter((t) => t !== "");
  if (normalizedTerms.length === 0) {
    return [{ text: source.slice(0, 90), hit: false }];
  }
  const lowered = normalizePersian(source);
  let first = -1;
  let hitLen = 0;
  for (const term of normalizedTerms) {
    const at = lowered.indexOf(term);
    if (at >= 0 && (first < 0 || at < first)) {
      first = at;
      hitLen = term.length;
    }
  }
  if (first < 0) return [{ text: source.slice(0, 90), hit: false }];
  const start = Math.max(0, first - 40);
  const end = Math.min(source.length, first + hitLen + 50);
  const segments: ExcerptSegment[] = [];
  if (start > 0) segments.push({ text: "…", hit: false });
  // Map normalized offsets back approximately: re-scan the raw slice.
  const slice = source.slice(start, end);
  const sliceLower = normalizePersian(slice);
  let cursor = 0;
  const ranges: Array<[number, number]> = [];
  for (const term of normalizedTerms) {
    let at = sliceLower.indexOf(term, cursor);
    while (at >= 0) {
      ranges.push([at, at + term.length]);
      at = sliceLower.indexOf(term, at + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  for (const [from, to] of ranges) {
    if (from > cursor) segments.push({ text: slice.slice(cursor, from), hit: false });
    if (to > cursor) segments.push({ text: slice.slice(Math.max(from, cursor), to), hit: true });
    cursor = Math.max(cursor, to);
  }
  if (cursor < slice.length) segments.push({ text: slice.slice(cursor), hit: false });
  if (end < source.length) segments.push({ text: "…", hit: false });
  return segments;
}

export interface WhyExplanation {
  sentence: string;
  present: string[];
  absentExcluded: string[];
}

/**
 * Builds the «چرا این آگهی؟» explanation strictly from matcher evidence:
 * required terms actually detected in the text, plus excluded terms verified
 * absent. Returns null when there is nothing factual to explain.
 */
export function explainWhy(
  ad: FixtureAd,
  includeTerms: string[],
  excludeTerms: string[]
): WhyExplanation | null {
  const text = adSearchText(ad);
  const present = includeTerms.filter((t) => {
    const { phrase } = stripQuotes(t);
    return phrase !== "" && includesTerm(text, t);
  });
  const absentExcluded = excludeTerms.filter((t) => {
    const { phrase } = stripQuotes(t);
    return phrase !== "" && !includesTerm(text, t);
  });
  if (present.length === 0 && absentExcluded.length === 0) return null;
  const quoted = (terms: string[]) => terms.map((t) => `«${t}»`).join(" و ");
  let sentence = "";
  if (present.length > 0) sentence += `چون ${quoted(present)} در توضیحات دیده شد`;
  if (absentExcluded.length > 0) {
    sentence +=
      (sentence === "" ? "چون " : " و ") + `${quoted(absentExcluded)} پیدا نشد`;
  }
  return { sentence: `${sentence}.`, present, absentExcluded };
}

export type SortKey = "best" | "cheap" | "pricey";

/**
 * Genuine local sort. Newest is NOT offered: fixtures carry no reliable
 * timestamps, and fabricating freshness order would be dishonest.
 */
export function sortResults<T extends { ad: FixtureAd }>(list: T[], sort: SortKey): T[] {
  if (sort === "best") return list;
  const priced = list.filter((item) => item.ad.price !== null);
  const unpriced = list.filter((item) => item.ad.price === null);
  priced.sort((a, b) =>
    sort === "cheap"
      ? (a.ad.price as number) - (b.ad.price as number)
      : (b.ad.price as number) - (a.ad.price as number)
  );
  return [...priced, ...unpriced];
}

/**
 * Genuine local matching over explicit data (fixtures today, backend later).
 * Include = must be present. Exclude = suppresses with a factual reason.
 * Unknown stays unknown: preferences absent from text become ؟ notes, never filters.
 *
 * Price contract: KNOWN vs UNKNOWN. A price filter the ad cannot answer
 * (ad.price === null) is UNKNOWN, not a miss — the ad stays in results but
 * is visibly marked (warning tone) and never earns «قیمت در محدوده».
 *
 * Query contract: the queryTerms `some()` gate below is a LOCAL retrieval
 * stand-in (approximates "the provider returned this ad for the query").
 * The backend must NOT port it blindly — it implements the four semantic
 * roles instead (see QueryRole in types/search.ts): query feeds
 * interpretation + provider query construction; include is mandatory;
 * preference is ranking-only; exclude is a hard negative.
 */
export function runSearch(
  ctx: SearchContext,
  ads: FixtureAd[],
  preferences: string[] = []
): SearchOutcome {
  const include = ctx.includeKeywords.map((t) => normalizePersian(t)).filter((t) => t !== "");
  const exclude = ctx.excludeKeywords.map((t) => normalizePersian(t)).filter((t) => t !== "");
  const prefs = preferences.map((t) => normalizePersian(t)).filter((t) => t !== "");
  const queryTerms = queryContentTerms(ctx.query, exclude);
  const priceFilterActive = ctx.priceMin !== null || ctx.priceMax !== null;

  const results: MatchResult[] = [];
  const suppressed: SuppressedAd[] = [];

  for (const ad of ads) {
    if (!ad.id || !ad.title) throw new Error("Invalid fixture ad: missing id or title");
    const text = adSearchText(ad);

    const hitExclude = exclude.find((term) => includesTerm(text, term));
    if (hitExclude) {
      suppressed.push({ adId: ad.id, reason: `حذف‌شده به دلیل: ${hitExclude}` });
      continue;
    }
    if (!include.every((term) => includesTerm(text, term))) continue;
    if (queryTerms.length > 0 && !queryTerms.some((term) => text.includes(term))) continue;
    if (ctx.category !== "all" && ad.categoryId !== ctx.category) continue;
    if (ctx.city !== "all" && ad.cityId !== ctx.city) continue;
    if (ctx.priceMin !== null && ad.price !== null && ad.price < ctx.priceMin) continue;
    if (ctx.priceMax !== null && ad.price !== null && ad.price > ctx.priceMax) continue;
    if (ctx.hasImage && !ad.thumbnail) continue;

    const priceState: PriceState =
      priceFilterActive && ad.price === null ? "unknown" : "known";

    const reasons: MatchReason[] = [];
    for (const term of include.slice(0, 2)) {
      reasons.push({ tone: "signal", text: term });
    }
    if (priceState === "unknown") {
      reasons.push({ tone: "warning", text: "قیمت نامشخص" });
    }
    if (ctx.city !== "all") reasons.push({ tone: "signal", text: ad.city });
    if (priceFilterActive && ad.price !== null) {
      reasons.push({ tone: "signal", text: "قیمت در محدوده" });
    }

    const evidence: AdEvidence[] = include.map((term) => ({ term, status: "detected" }));
    const unknowns = prefs.filter((term) => !text.includes(term));
    for (const term of unknowns) evidence.push({ term, status: "unknown" });

    results.push({
      adId: ad.id,
      reasons: reasons.slice(0, 3),
      evidence,
      strongMatch: unknowns.length === 0 && reasons.length > 0,
      priceState,
    });
  }

  return { results, suppressed };
}
