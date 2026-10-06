import "server-only";

import { textMatches } from "@/lib/persianNormalize";
import { dupKey } from "@/lib/nearDup";
import {
  MAX_DETAILS_PER_HUNT,
  MAX_LIST_PAGES_PER_HUNT,
  ProviderError,
  type ListingSummary,
} from "../divar/provider";
import { divarProvider } from "../divar/divarClient";
import { CATEGORY_API_VALUE, LEAF_CATEGORY, resolveCityId } from "../divar/taxonomy";
import { parsePriceBound } from "./definition";

/**
 * M4 search pipeline — the actual hunt. Runs server-side, streams progress
 * events (the client renders them with docs/hunt-progress-copy.md).
 *
 * Flow: list pages (cap 20, query-scoped) → title SCORING (recall-oriented,
 * Persian-aware) → near-dup collapse → details in prioritized batches of
 * 10 → description rules (hard AND over title+description) → scoring
 * (rubric in docs/output-quality.md flaw #2) → ranked.
 *
 * The title phase never hard-filters on includes (flaw #12): attributes
 * like neighborhoods routinely live in descriptions, not titles. Precision
 * lives in the description phase; the title phase exists for recall.
 *
 * Quality invariants (never weaken):
 * - textMatches, never raw includes (output-quality.md flaw #1);
 * - failed detail fetch = "unknown", never a silent drop;
 * - stale lists propagate a stale flag, never presented as fresh.
 */

export interface HuntDefinition {
  query: string;
  include: string[];
  exclude: string[];
  /** City slug ("tehran") or "all". */
  city: string;
  /** App category key ("real-estate", "mobile", ...). */
  category: string;
  priceMin: string;
  priceMax: string;
  transaction: "" | "rent" | "buy";
  condition: "" | "new" | "used" | "any";
  /**
   * Second-phase opt-in («می‌خوای برم سراغ قدیمی‌ترها؟»): when true, the
   * list phase starts at page MAX_LIST_PAGES_PER_HUNT instead of 0 — the
   * older half of the inventory. Same hunt, no extra quota.
   */
  deepHistory?: boolean;
}

export interface ScoreBreakdown {
  title: number;
  description: number;
  priceKnown: number;
}

export interface ScoredAd {
  sourceAdId: string;
  title: string;
  price: number | null;
  priceText?: string;
  city: string;
  thumbnail?: string;
  score: number;
  breakdown: ScoreBreakdown;
  /** Matched terms with where they matched — «چرا این آگهی؟» for free. */
  evidence: string[];
  /** True when the detail fetch failed — shown, never dropped. */
  detailUnknown?: boolean;
}

export interface HuntStats {
  adsSeen: number;
  titleRejected: number;
  dupsCollapsed: number;
  candidates: number;
  detailsChecked: number;
  confirmed: number;
  stale: boolean;
  nearMiss: number;
}

export type HuntEvent =
  | { type: "started"; query: string }
  | { type: "lists-progress"; pagesDone: number; adsSeen: number }
  | { type: "lists-done"; adsSeen: number; stale: boolean }
  | { type: "ranked"; scored: number; shortlisted: number; excluded: number }
  | { type: "candidates"; count: number; dupsCollapsed: number }
  | { type: "big-hunt"; candidates: number }
  | { type: "details-batch"; checked: number; total: number; confirmed: ScoredAd[] }
  | { type: "done"; results: ScoredAd[]; stats: HuntStats }
  | { type: "error"; errorClass: string; message: string };

const DETAIL_BATCH = 10;

export interface Candidate extends ListingSummary {
  titleStrength: number;
  needsDetailReview: boolean;
}

export interface CollectOptions {
  /**
   * First LOGICAL list page (cache-key offset only). Default honors
   * def.deepHistory (the second phase continues after the first).
   * Kamin checks always start at 0 — they scan the recency window,
   * never history.
   */
  startPage?: number;
  /**
   * Cursor to resume from (the first phase's endCursor, for deep-history).
   * Undefined = start at the newest page.
   */
  startCursor?: unknown;
  /**
   * List-page budget. Default MAX_LIST_PAGES_PER_HUNT (full hunts).
   * Kamin checks pass a smaller time-derived budget — the window is
   * since-last-success, never a quality cut.
   */
  maxPages?: number;
  emit?: (e: HuntEvent) => void;
}

/** «طرح X» weasel guard: the term appears but prefixed with طرح (fake). */
function isWeasel(title: string, term: string): boolean {
  return title.includes(`طرح ${term}`) || title.includes(`طرح${term}`);
}

/**
 * Title SCORING — deliberately NOT a filter (flaw #12, 2026-10-06).
 *
 * The old titlePass was a hard AND over every include term: an ad titled
 * «اپارتمان نوساز ۱۰۰ متری» that named سعادت‌آباد only in its description
 * was killed before the description was ever read — and attributes
 * (neighborhood, specs) routinely live in descriptions, not titles.
 *
 * Now the title phase hard-rejects ONLY on excludes («نه» means نه — cheap
 * and safe). Everything else is scored by title strength; the top of the
 * ranking goes to the detail phase, where descriptionPass applies the hard
 * AND over title+description combined. Recall at the title, precision at
 * the description.
 */
function titleScore(ad: ListingSummary, def: HuntDefinition): {
  excluded: boolean;
  strength: number;
  needsDetailReview: boolean;
} {
  for (const term of def.exclude) {
    if (textMatches(ad.title, term)) {
      return { excluded: true, strength: 0, needsDetailReview: false };
    }
  }
  let strength = 0;
  let needsDetailReview = false;
  for (const term of def.include) {
    if (textMatches(ad.title, term)) {
      strength += 1;
      if (isWeasel(ad.title, term)) needsDetailReview = true;
    }
  }
  return { excluded: false, strength, needsDetailReview };
}

/**
 * Explicit condition cues, matched at TOKEN level (textMatches) so «نوساز»
 * never matches «نو». Finding #2 (bug-bounty 2026-10-06): the form asks
 * نو/کارکرده and the engine must honor it.
 */
const NEW_CUES = ["آکبند", "نو"];
const USED_CUES = ["کارکرده", "دست دوم", "استوک"];

/**
 * Condition gate — rejects ONLY on explicit contradiction.
 * condition=new + «کارکرده» in the ad → out. condition=used + «آکبند» → out.
 * An ad that states NO condition passes (unknown ≠ dropped — invariant).
 * "any"/"" = no gate.
 */
function conditionPass(combined: string, def: HuntDefinition): boolean {
  if (def.condition === "new") {
    return !USED_CUES.some((cue) => textMatches(combined, cue));
  }
  if (def.condition === "used") {
    return !NEW_CUES.some((cue) => textMatches(combined, cue));
  }
  return true;
}

function descriptionPass(
  description: string,
  title: string,
  def: HuntDefinition
): { pass: boolean; strength: number; evidence: string[] } {
  const evidence: string[] = [];
  let strength = 0;
  const combined = `${title} ${description}`;
  for (const term of def.include) {
    if (textMatches(combined, term)) {
      strength += 1;
      evidence.push(term);
    } else {
      return { pass: false, strength: 0, evidence: [] };
    }
  }
  for (const term of def.exclude) {
    if (textMatches(combined, term)) {
      return { pass: false, strength: 0, evidence: [] };
    }
  }
  if (!conditionPass(combined, def)) {
    return { pass: false, strength: 0, evidence: [] };
  }
  return { pass: true, strength, evidence };
}

function scoreAd(
  titleStrength: number,
  descStrength: number,
  includeCount: number,
  price: number | null
): { score: number; breakdown: ScoreBreakdown } {
  const title = includeCount > 0 ? titleStrength / includeCount : 1;
  const description = includeCount > 0 ? descStrength / includeCount : 1;
  const priceKnown = price !== null ? 0.5 : 0;
  const breakdown: ScoreBreakdown = { title, description, priceKnown };
  return { score: 3 * title + 2 * description + priceKnown, breakdown };
}

/**
 * M4 pipeline, split for the M5 kamin engine.
 *
 * collectCandidates = phases 1-3 (query-scoped list pages -> title scoring
 * -> near-dup collapse). confirmCandidates = phases 4-5 (details in
 * prioritized batches of 10 -> ranking). runPipeline composes both.
 *
 * The kamin engine calls collectCandidates with a small recency budget,
 * diffs candidate ids against its seen baseline, then calls
 * confirmCandidates with ONLY the new ids — details are never re-fetched
 * for ads the user already knows about.
 */
export async function collectCandidates(
  def: HuntDefinition,
  opts: CollectOptions = {}
): Promise<{ candidates: Candidate[]; stats: HuntStats; endCursor?: unknown }> {
  const emit = opts.emit ?? (() => {});
  const stats: HuntStats = {
    adsSeen: 0,
    titleRejected: 0,
    dupsCollapsed: 0,
    candidates: 0,
    detailsChecked: 0,
    confirmed: 0,
    stale: false,
    nearMiss: 0,
  };

  emit({ type: "started", query: def.query });

  // ---- Phase 1: list pages (cursor-chained) ---------------------------------
  // Finding #1 (bug-bounty 2026-10-06): page numbers alone do NOT paginate
  // Divar — every request without pagination_data returns page 0. The walk
  // threads the opaque cursor (pagination.data) through top-level
  // pagination_data; `page` is only a logical counter (cache key, budget).
  // Deep-history resumes from the first phase's endCursor.
  const startPage =
    opts.startPage ?? (def.deepHistory === true ? MAX_LIST_PAGES_PER_HUNT : 0);
  const maxPages = opts.maxPages ?? MAX_LIST_PAGES_PER_HUNT;
  // The transaction answer is honored at the provider (flaw #13): Divar
  // splits apartments into sell/rent leaves, so a «خرید» answer must not
  // scan rentals (and vice versa). The form asks — the engine must obey.
  const categorySlug =
    def.category === "real-estate" && def.transaction === "rent"
      ? LEAF_CATEGORY.apartmentRent
      : def.category === "real-estate" && def.transaction === "buy"
        ? LEAF_CATEGORY.apartmentSell
        : (CATEGORY_API_VALUE[def.category] ?? "");
  const cityId = def.city !== "all" ? await resolveCityId(def.city) : null;
  const all: ListingSummary[] = [];
  let pagesDone = 0;
  let cursor: unknown = opts.startCursor;
  let endCursor: unknown = undefined;
  for (let i = 0; i < maxPages; i++) {
    let res;
    try {
      res = await divarProvider.searchLists({
        categorySlug,
        cityId: cityId ?? "",
        // The hunt's content terms scope the list phase server-side
        // (flaw #11): without this we only ever see the freshest N ads of
        // everything, and older relevant inventory is unreachable.
        keywords: def.include,
        page: startPage + i,
        cursor,
      });
    } catch (e) {
      if (e instanceof ProviderError) {
        emit({ type: "error", errorClass: e.errorClass, message: e.message });
        throw e;
      }
      throw e;
    }
    if (res.stale) stats.stale = true;
    all.push(...res.listings);
    pagesDone += 1;
    stats.adsSeen = all.length;
    emit({ type: "lists-progress", pagesDone, adsSeen: all.length });
    endCursor = res.nextCursor;
    // No cursor or no more pages: the walk ends here. Never loop on a
    // missing cursor — that would re-fetch the same page forever.
    if (!res.hasMore || res.nextCursor === undefined || res.nextCursor === null) break;
    cursor = res.nextCursor;
  }
  emit({ type: "lists-done", adsSeen: all.length, stale: stats.stale });

  // ---- Phase 2: title scoring + shortlist (recall-oriented) -----------------
  // No hard include filter at title level (flaw #12). Score every ad,
  // rank by title strength, and let the detail phase decide. Only EXCLUDES
  // hard-reject here — «نه» means نه.
  const scored: Candidate[] = [];
  let excluded = 0;
  for (const ad of all) {
    const r = titleScore(ad, def);
    if (r.excluded) {
      excluded += 1;
      stats.titleRejected += 1;
      continue;
    }
    scored.push({
      ...ad,
      titleStrength: r.strength,
      needsDetailReview: r.needsDetailReview,
    });
  }
  scored.sort((a, b) => b.titleStrength - a.titleStrength);

  // ---- Phase 3: near-dup collapse (keep newest = first seen) ---------------
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const c of scored) {
    const key = dupKey(c.title, c.price !== null ? String(c.price) : null);
    if (seen.has(key)) {
      stats.dupsCollapsed += 1;
      continue;
    }
    seen.add(key);
    unique.push(c);
  }
  emit({
    type: "ranked",
    scored: all.length,
    shortlisted: unique.length,
    excluded,
  });
  stats.candidates = unique.length;
  emit({ type: "candidates", count: unique.length, dupsCollapsed: stats.dupsCollapsed });

  // ---- Phase 3b: price bounds (hunt specs are honored) ---------------------
  // Unknown-price ads STAY (contract) — only KNOWN prices outside the range
  // are dropped. Runs before the details budget so we never spend detail
  // fetches on ads the price spec already rules out.
  const minPrice = parsePriceBound(def.priceMin);
  const maxPrice = parsePriceBound(def.priceMax);
  let priced = unique;
  if (minPrice !== null || maxPrice !== null) {
    priced = unique.filter(
      (c) =>
        c.price === null ||
        (minPrice === null || c.price >= minPrice) &&
          (maxPrice === null || c.price <= maxPrice)
    );
    stats.candidates = priced.length;
  }

  // Big-hunt signal: the UI suggests narrowing; pipeline continues with top 100.
  if (priced.length > 100) emit({ type: "big-hunt", candidates: priced.length });

  return { candidates: priced, stats, endCursor };
}

export async function confirmCandidates(
  candidates: Candidate[],
  def: HuntDefinition,
  stats: HuntStats,
  emit: (e: HuntEvent) => void = () => {}
): Promise<ScoredAd[]> {
  // ---- Phase 4: details in prioritized batches of 10 ----------------------
  candidates.sort((a, b) => b.titleStrength - a.titleStrength);
  const toCheck = candidates.slice(0, MAX_DETAILS_PER_HUNT);
  const includeCount = def.include.length;
  const results: ScoredAd[] = [];
  const confirmed: ScoredAd[] = [];

  for (let i = 0; i < toCheck.length; i += DETAIL_BATCH) {
    const batch = toCheck.slice(i, i + DETAIL_BATCH);
    const batchConfirmed: ScoredAd[] = [];
    for (const c of batch) {
      stats.detailsChecked += 1;
      let description = "";
      let detailUnknown = false;
      try {
        const detail = await divarProvider.getDetail(c.sourceAdId);
        description = detail.description;
      } catch {
        // Invariant: failed detail = "unknown", never a silent drop.
        detailUnknown = true;
      }
      if (detailUnknown) {
        const { score, breakdown } = scoreAd(c.titleStrength, 0, includeCount, c.price);
        const ad: ScoredAd = {
          sourceAdId: c.sourceAdId,
          title: c.title,
          price: c.price,
          priceText: c.priceText,
          city: c.city,
          thumbnail: c.thumbnail,
          score: score * 0.5, // unknown details rank below verified ones
          breakdown,
          evidence: [],
          detailUnknown: true,
        };
        results.push(ad);
        batchConfirmed.push(ad);
        continue;
      }
      const r = descriptionPass(description, c.title, def);
      if (!r.pass) {
        stats.nearMiss += 1;
        continue;
      }
      const { score, breakdown } = scoreAd(c.titleStrength, r.strength, includeCount, c.price);
      const ad: ScoredAd = {
        sourceAdId: c.sourceAdId,
        title: c.title,
        price: c.price,
        priceText: c.priceText,
        city: c.city,
        thumbnail: c.thumbnail,
        score,
        breakdown,
        evidence: r.evidence,
      };
      results.push(ad);
      batchConfirmed.push(ad);
    }
    stats.confirmed = results.length;
    confirmed.push(...batchConfirmed);
    emit({
      type: "details-batch",
      checked: stats.detailsChecked,
      total: toCheck.length,
      confirmed: batchConfirmed,
    });
  }

  // ---- Phase 5: ranking ----------------------------------------------------
  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function runPipeline(
  def: HuntDefinition,
  emit: (e: HuntEvent) => void,
  opts: { startCursor?: unknown } = {}
): Promise<{ results: ScoredAd[]; stats: HuntStats; endCursor?: unknown }> {
  const { candidates, stats, endCursor } = await collectCandidates(def, {
    emit,
    startCursor: opts.startCursor,
  });
  const results = await confirmCandidates(candidates, def, stats, emit);
  emit({ type: "done", results, stats });
  return { results, stats, endCursor };
}
