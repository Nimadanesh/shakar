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
import { CATEGORY_API_VALUE, resolveCityId } from "../divar/taxonomy";

/**
 * M4 search pipeline — the actual hunt. Runs server-side, streams progress
 * events (the client renders them with docs/hunt-progress-copy.md).
 *
 * Flow: list pages (cap 20) → title rules (textMatches, Persian-aware) →
 * near-dup collapse → details in prioritized batches of 10 → description
 * rules → scoring (rubric in docs/output-quality.md flaw #2) → ranked.
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
  | { type: "filter-wave"; wave: number; rejected: number; totalRejected: number }
  | { type: "candidates"; count: number; dupsCollapsed: number }
  | { type: "big-hunt"; candidates: number }
  | { type: "details-batch"; checked: number; total: number; confirmed: ScoredAd[] }
  | { type: "done"; results: ScoredAd[]; stats: HuntStats }
  | { type: "error"; errorClass: string; message: string };

const DETAIL_BATCH = 10;
/** Emit a filter-wave event every N title rejections (chunked discernment). */
const WAVE_EVERY = 50;

interface Candidate extends ListingSummary {
  titleStrength: number;
  needsDetailReview: boolean;
}

/** «طرح X» weasel guard: the term appears but prefixed with طرح (fake). */
function isWeasel(title: string, term: string): boolean {
  return title.includes(`طرح ${term}`) || title.includes(`طرح${term}`);
}

function titlePass(ad: ListingSummary, def: HuntDefinition): {
  pass: boolean;
  strength: number;
  needsDetailReview: boolean;
} {
  let strength = 0;
  let needsDetailReview = false;
  for (const term of def.include) {
    if (textMatches(ad.title, term)) {
      strength += 1;
      if (isWeasel(ad.title, term)) needsDetailReview = true;
    } else {
      return { pass: false, strength: 0, needsDetailReview: false };
    }
  }
  for (const term of def.exclude) {
    if (textMatches(ad.title, term)) {
      return { pass: false, strength: 0, needsDetailReview: false };
    }
  }
  return { pass: true, strength, needsDetailReview };
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

export async function runPipeline(
  def: HuntDefinition,
  emit: (e: HuntEvent) => void
): Promise<{ results: ScoredAd[]; stats: HuntStats }> {
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

  // ---- Phase 1: list pages -------------------------------------------------
  // Deep-history second phase starts where the first phase stopped.
  const startPage = def.deepHistory === true ? MAX_LIST_PAGES_PER_HUNT : 0;
  const categorySlug = CATEGORY_API_VALUE[def.category] ?? "";
  const cityId = def.city !== "all" ? await resolveCityId(def.city) : null;
  const all: ListingSummary[] = [];
  let pagesDone = 0;
  for (let page = startPage; page < startPage + MAX_LIST_PAGES_PER_HUNT; page++) {
    let res;
    try {
      res = await divarProvider.searchLists({
        categorySlug,
        cityId: cityId ?? "",
        keywords: [],
        page,
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
    if (!res.hasMore) break;
  }
  emit({ type: "lists-done", adsSeen: all.length, stale: stats.stale });

  // ---- Phase 2: title rules (chunked discernment waves) --------------------
  const survivors: Candidate[] = [];
  let waveRejected = 0;
  let wave = 0;
  const emitWave = () => {
    wave += 1;
    emit({ type: "filter-wave", wave, rejected: waveRejected, totalRejected: stats.titleRejected });
  };
  for (const ad of all) {
    const r = titlePass(ad, def);
    if (!r.pass) {
      stats.titleRejected += 1;
      waveRejected += 1;
      if (waveRejected >= WAVE_EVERY) {
        emitWave();
        waveRejected = 0;
      }
      continue;
    }
    survivors.push({ ...ad, titleStrength: r.strength, needsDetailReview: r.needsDetailReview });
  }
  if (waveRejected > 0 || stats.titleRejected > 0) {
    emitWave();
  }

  // ---- Phase 3: near-dup collapse (keep newest = first seen) ---------------
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const c of survivors) {
    const key = dupKey(c.title, c.price !== null ? String(c.price) : null);
    if (seen.has(key)) {
      stats.dupsCollapsed += 1;
      continue;
    }
    seen.add(key);
    unique.push(c);
  }
  stats.candidates = unique.length;
  emit({ type: "candidates", count: unique.length, dupsCollapsed: stats.dupsCollapsed });

  if (unique.length === 0) {
    const results: ScoredAd[] = [];
    emit({ type: "done", results, stats });
    return { results, stats };
  }

  // Big-hunt signal: the UI suggests narrowing; pipeline continues with top 100.
  if (unique.length > 100) emit({ type: "big-hunt", candidates: unique.length });

  // ---- Phase 4: details in prioritized batches of 10 ----------------------
  unique.sort((a, b) => b.titleStrength - a.titleStrength);
  const toCheck = unique.slice(0, MAX_DETAILS_PER_HUNT);
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
  emit({ type: "done", results, stats });
  return { results, stats };
}
