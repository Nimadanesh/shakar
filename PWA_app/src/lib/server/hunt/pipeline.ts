import "server-only";

import { normalizeForMatch, textMatches } from "@/lib/persianNormalize";
import {
  DEALER_CUES,
  DEALER_FIRST_PERSON,
  GOODS_SALE_CUES,
  NEEDS_REPAIR_CUES,
  SERVICE_DEMAND_FAMILY,
  SERVICE_PROVIDER_CUES,
  detectTransaction,
  isServiceDemandTerm,
} from "@/lib/interpret";
import {
  assessListingRole,
  assessModelSpecificity,
  assessQueryIntent,
  assessRepairPolarity,
  assessRepairService,
  assessServiceTarget,
  exclusionFires,
  isRepairWord,
  rolesClash,
} from "./semantics";
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
 * 10 → intent evaluation (MUST/SHOULD/MUST-NOT/UNKNOWN, flaw #19) →
 * scoring (rubric in docs/output-quality.md flaw #2) → ranked.
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
  /**
   * SHOULD terms — ranking boost only (flaw #19, 2026-10-09). Populated
   * from the query's preference cues («ترجیحاً»). Never filters, never
   * penalizes: absence is simply no boost.
   */
  should: string[];
  /** City slug ("tehran") or "all". */
  city: string;
  /**
   * Where the final city came from (navid 2026-10-08). "text" when a city
   * word in the query overrode the picker/remembered value, "picker"
   * otherwise. Persisted so a future "why did my hunt run in X?!" is
   * answerable from the definition alone.
   */
  citySource?: "text" | "picker";
  /** App category key ("real-estate", "mobile", ...). */
  category: string;
  priceMin: string;
  priceMax: string;
  transaction: "" | "rent" | "buy";
  condition: "" | "new" | "used" | "any";
  /**
   * Service intent (P0, HumanTest S3): the query wants a SERVICE performed
   * («تعمیر یخچال»), not a good. Computed by detectServiceIntent in
   * resolveHuntDefinition. Optional for backward compatibility with
   * pre-intent definitions and tests — absent means false.
   */
  serviceIntent?: boolean;
  /**
   * Transaction direction (P1, HumanTest S4): which side of the deal the
   * hunter is on. "buy" = hunter wants seller listings (dealer «خریدار»
   * ads are competitors → demoted); "sell" = hunter wants buyers (dealer
   * ads are the buyers → kept). Set explicitly by the hunt form when it
   * captures direction (decision bank Q6: never guessed from query text);
   * absent defaults to "buy" — the common hunter is a buyer, and the S4
   * rubric grades from that side.
   */
  direction?: "buy" | "sell";
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
  /**
   * Intent verdict (flaw #19): "exact" = every MUST term evidenced in the
   * ad's text; "near" = at least one MUST term evidenced, the rest UNKNOWN.
   * The results UI labels near-misses honestly — never a silent drop.
   */
  matchKind: "exact" | "near";
  /** MUST terms with no evidence in title or description (the UNKNOWN set). */
  missingInfo: string[];
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
  /**
   * Redefined 2026-10-09 (flaw #19): ads KEPT as near-miss results
   * (verdict "near") — shown to the user, labeled honestly. Was: ads
   * rejected by the description hard-AND.
   */
  nearMiss: number;
  /**
   * Detail-phase rejections (flaw #19): zero MUST evidence, MUST_NOT hits,
   * and explicit condition contradictions.
   */
  rejectedNoMatch: number;
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

/**
 * Collapse near-duplicate reposts, keeping the FIRST occurrence in input
 * order. Callers must pass candidates in FETCH order (Divar lists are
 * newest-first), so the survivor is the newest repost — never the
 * highest-scoring one (bug #19, round 4: dedupe must run before the
 * ranking sort, not after).
 *
 * Exported for testing — the #19 regression test feeds it dupes where the
 * newer ad has a LOWER titleStrength and asserts the newer still wins.
 */
export function collapseDupes(cands: Candidate[]): {
  unique: Candidate[];
  dupsCollapsed: number;
} {
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  let dupsCollapsed = 0;
  for (const c of cands) {
    const key = dupKey(
      c.title,
      c.price !== null ? String(c.price) : null,
      c.city,
      c.district
    );
    if (seen.has(key)) {
      dupsCollapsed += 1;
      continue;
    }
    seen.add(key);
    unique.push(c);
  }
  return { unique, dupsCollapsed };
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
 * and safe). MUST terms score double, SHOULD terms score single; the top of
 * the ranking goes to the detail phase, where evaluateDescription applies
 * the intent buckets over title+description combined (flaw #19). Recall at
 * the title, precision at the description.
 */
function titleScore(ad: ListingSummary, def: HuntDefinition): {
  excluded: boolean;
  strength: number;
  needsDetailReview: boolean;
} {
  for (const term of def.exclude) {
    // Scoped exclusion (unified engine): a title that explicitly marks
    // repair-absent («آیفون ۱۳ بدون تعمیر») must survive the title phase so
    // the detail phase can verify it. «نه» still means نه.
    if (exclusionFires(ad.title, term, def.category)) {
      return { excluded: true, strength: 0, needsDetailReview: false };
    }
  }
  let strength = 0;
  let needsDetailReview = false;
  for (const term of def.include) {
    if (textMatches(ad.title, term)) {
      strength += 2; // MUST weighs double at the title (flaw #19)
      if (isWeasel(ad.title, term)) needsDetailReview = true;
    }
  }
  // SHOULD is a nudge, never a gate. Pre-#19 snapshots lack the bucket.
  for (const term of def.should ?? []) {
    if (textMatches(ad.title, term)) {
      strength += 1;
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

export interface DescriptionEvaluation {
  verdict: "exact" | "near" | "rejected";
  /** Matched MUST (+SHOULD) surface terms — «چرا این آگهی؟» for free. */
  evidence: string[];
  /** MUST terms with no evidence in title or description (the UNKNOWN set). */
  missingInfo: string[];
  /** MUST terms matched in the title. */
  mustTitle: number;
  /** MUST terms matched only in the description. */
  mustDesc: number;
  /** SHOULD terms matched in title+description. */
  shouldMatched: number;
  /**
   * Service-intent signals (P0): provider-cue hits, goods-for-sale cue
   * hits, and needs-repair cue hits in title+description. Counted only
   * when def.serviceIntent is true; zero otherwise, so non-service hunts
   * are never affected.
   */
  providerHits: number;
  goodsHits: number;
  needsRepairHits: number;
  /**
   * P1 transaction direction (HumanTest S4): dealer «خریدار» ads are
   * competitors when the hunter wants sellers. True unless the hunt
   * explicitly set direction "sell".
   */
  dealerHits: number;
  huntWantsSellers: boolean;
}

function rejectedEvaluation(): DescriptionEvaluation {
  return {
    verdict: "rejected",
    evidence: [],
    missingInfo: [],
    mustTitle: 0,
    mustDesc: 0,
    shouldMatched: 0,
    providerHits: 0,
    goodsHits: 0,
    needsRepairHits: 0,
    dealerHits: 0,
    huntWantsSellers: true,
  };
}

/** Count cue hits in text (P0 service-intent signals). */
function countCues(text: string, cues: string[]): number {
  let n = 0;
  for (const cue of cues) if (textMatches(text, cue)) n += 1;
  return n;
}

/**
 * Strip needs-repair phrases before provider-cue counting (P0 refinement).
 * «نیازمند تعمیرکار» / «نیاز به تعمیرکار» describes the ITEM's need (a
 * broken good for sale), not the seller's trade — the provider cue inside
 * must not count as provider evidence, and the needs-repair demotion must
 * still fire. Only the cue directly governed by the need-word is stripped;
 * a genuine «تعمیرکار یخچال» elsewhere in the text still counts.
 */
function stripNeedPhrases(text: string): string {
  return text
    .replace(/نیازمند\s+\S+/g, " ")
    .replace(/نیاز\s+به\s+\S+/g, " ")
    .replace(/محتاج\s+\S+/g, " ");
}

/**
 * Dealer hits (P1, HumanTest S4): fixed phrases («خریدارم») plus the
 * proximity rule — «خریدار» with a first-person marker («خریدار یخچال
 * هستیم») anywhere in the text. Bare «هستیم» without خریدار never counts.
 */
function countDealerHits(text: string): number {
  let n = countCues(text, DEALER_CUES);
  if (
    textMatches(text, "خریدار") &&
    countCues(text, DEALER_FIRST_PERSON) > 0
  ) {
    n += 1;
  }
  return n;
}

/**
 * Semantic compatibility caps (unified engine — from laptop semantics.ts).
 * True when a would-be exact must be capped to near. Kept and ranked,
 * never silently dropped.
 *
 * Two adaptations for the unified engine:
 * - Intent is assessed on the STRIPPED include terms, not the raw query.
 *   P1 strips role words (خریدار/فروشنده) from MUST; assessing the raw
 *   query would resurrect the S4 inversion as a phantom buyer-seeking
 *   intent and cap the very seller listings the hunter wants.
 * - Service intent is the union of the lexical detector (def.serviceIntent
 *   — covers نصب/نصاب phrasing the role assessor misses) and the role
 *   assessor.
 *
 * Contract (never weaken): the semantic layer decides the VERDICT
 * (exact vs near); the scoring signals (P0/P1) decide RANKING.
 */
function semanticCapFires(def: HuntDefinition, combined: string): boolean {
  const intent = assessQueryIntent(def.include.join(" "), def.category, def.transaction);
  const role = assessListingRole(combined);
  const explicitBuy =
    def.transaction === "buy" || detectTransaction(def.query) === "buy";
  const clash = rolesClash(intent, role, explicitBuy);
  const identity = clash.clash
    ? { mismatch: false as const, reason: "skipped:role-clash" }
    : assessModelSpecificity(def.include, combined, def.category);
  const repairRequested = def.exclude.some((t) => isRepairWord(t));
  const repairUnknown =
    repairRequested && assessRepairPolarity(combined).polarity === "unknown";
  const repairService = assessRepairService(combined);
  const serviceIntent = (def.serviceIntent ?? false) || intent.role === "service";
  const needsRepairMismatch =
    serviceIntent &&
    repairService.signal === "item_needs_repair" &&
    role.role !== "service";
  const unsupportedServiceExact =
    serviceIntent &&
    role.role === "unknown" &&
    repairService.signal !== "service_offered";
  const targetBound =
    !serviceIntent ||
    assessServiceTarget(def.include, combined, def.category).bound;
  return (
    clash.clash ||
    identity.mismatch ||
    repairUnknown ||
    needsRepairMismatch ||
    unsupportedServiceExact ||
    !targetBound
  );
}

/**
 * Intent evaluation (flaw #19, 2026-10-09) — replaces the hard-AND
 * descriptionPass that killed every near-miss (the «برنج هندی» zero-result).
 *
 * Buckets:
 * - MUST_NOT (def.exclude): any hit → rejected. «نه» means نه.
 * - Explicit condition contradictions → rejected (flaw #15).
 * - MUST (def.include): title match → mustTitle; else description match →
 *   mustDesc; else the term is UNKNOWN → missingInfo (penalized in scoring,
 *   NEVER dropped here).
 * - SHOULD (def.should): match → small boost. Never filters, never penalizes.
 *
 * Verdict: "rejected" only when the ad shows ZERO MUST evidence (the pigeon
 * rule — flaw #8 survives: an ad about something else entirely is not a
 * result). Otherwise "exact" (every MUST evidenced) or "near" (some MUST
 * UNKNOWN) — kept, ranked, and labeled honestly via missingInfo.
 */
function evaluateDescription(
  description: string,
  title: string,
  def: HuntDefinition
): DescriptionEvaluation {
  const combined = `${title} ${description}`;
  // 1. MUST_NOT — «نه» means نه, with repair-word polarity scoping (an
  // explicit «بدون تعمیر» listing satisfies a no-repair request instead of
  // being banned by its own vocabulary).
  for (const term of def.exclude) {
    if (exclusionFires(combined, term, def.category)) {
      return rejectedEvaluation();
    }
  }
  // 2. Explicit contradictions only (flaw #15) — unknown stays.
  if (!conditionPass(combined, def)) {
    return rejectedEvaluation();
  }
  // 3-4. SHOULD-only scan shared by the defensive empty-MUST path below.
  // Pre-#19 snapshots lack the bucket — normalize, never crash.
  const shouldTerms = def.should ?? [];
  const serviceIntent = def.serviceIntent ?? false;
  // Service-intent ad-type signals (P0): counted on title+description
  // combined, only when the hunt wants a service. Zero otherwise.
  const providerHits = serviceIntent
    ? countCues(stripNeedPhrases(normalizeForMatch(combined)), SERVICE_PROVIDER_CUES)
    : 0;
  const goodsHits = serviceIntent ? countCues(combined, GOODS_SALE_CUES) : 0;
  const needsRepairHits = serviceIntent ? countCues(combined, NEEDS_REPAIR_CUES) : 0;
  // P1 (HumanTest S4, flaw #22): dealer «خریدار» ads are competitors when
  // the hunter wants seller listings (the default); they ARE the buyers
  // when the hunter explicitly wants to sell.
  const huntWantsSellers = (def.direction ?? "buy") === "buy";
  const dealerHits = countDealerHits(combined);
  // Defensive: no MUST terms (never happens via resolveHuntDefinition, but
  // old snapshots and direct callers must not crash or pass vacuously).
  if (def.include.length === 0) {
    const evidence: string[] = [];
    let shouldMatched = 0;
    for (const term of shouldTerms) {
      if (textMatches(combined, term)) {
        shouldMatched += 1;
        evidence.push(term);
      }
    }
    return {
      verdict: evidence.length > 0 ? "near" : "rejected",
      evidence,
      missingInfo: [],
      mustTitle: 0,
      mustDesc: 0,
      shouldMatched,
      providerHits,
      goodsHits,
      needsRepairHits,
      dealerHits,
      huntWantsSellers,
    };
  }
  // 3. MUST with UNKNOWN semantics.
  const evidence: string[] = [];
  const missingInfo: string[] = [];
  let mustTitle = 0;
  let mustDesc = 0;
  for (const term of def.include) {
    // P0: a service-demand MUST term («تعمیر») is satisfied when the demand
    // appears in ANY morphological form («تعمیرکار», «تعمیرات»…). Token-level
    // matching alone is blind to the agentive form — the S3 root cause.
    const demandSatisfied =
      serviceIntent &&
      isServiceDemandTerm(term) &&
      SERVICE_DEMAND_FAMILY.some((w) => textMatches(combined, w));
    if (textMatches(title, term)) {
      mustTitle += 1;
      evidence.push(term);
    } else if (demandSatisfied || textMatches(description, term)) {
      mustDesc += 1;
      evidence.push(term);
    } else {
      missingInfo.push(term); // UNKNOWN — penalized in scoring, never dropped
    }
  }
  // 4. SHOULD — boost only.
  let shouldMatched = 0;
  for (const term of shouldTerms) {
    if (textMatches(combined, term)) {
      shouldMatched += 1;
      evidence.push(term);
    }
  }
  // 5. Verdict.
  if (mustTitle + mustDesc === 0) {
    return { ...rejectedEvaluation(), missingInfo, providerHits, goodsHits, needsRepairHits, dealerHits, huntWantsSellers };
  }
  // 5b. Semantic compatibility caps (unified engine). A would-be exact
  // that the semantic layer contradicts becomes near — kept and ranked,
  // never silently dropped.
  if (missingInfo.length === 0 && semanticCapFires(def, combined)) {
    return {
      verdict: "near",
      evidence,
      missingInfo,
      mustTitle,
      mustDesc,
      shouldMatched,
      providerHits,
      goodsHits,
      needsRepairHits,
      dealerHits,
      huntWantsSellers,
    };
  }
  return {
    verdict: missingInfo.length === 0 ? "exact" : "near",
    evidence,
    missingInfo,
    mustTitle,
    mustDesc,
    shouldMatched,
    providerHits,
    goodsHits,
    needsRepairHits,
    dealerHits,
    huntWantsSellers,
  };
}

/**
 * Weighted intent score (flaw #19). MUST title matches weigh most, then
 * MUST description matches, then price-known; SHOULD matches add a small
 * boost; UNKNOWN terms (missingInfo) subtract a small penalty. The breakdown
 * stays EXPLAINABLE (flaw #2) — never a magic number.
 *
 * P0 service-intent adjustments (HumanTest S3): a provider cue in the ad
 * lifts it (+1); a goods-for-sale ad — or a good NEEDING the service
 * («یخچال خراب نیازمند تعمیر», Q1) — with NO provider cue on a service
 * hunt sinks to the bottom (-4, scoring-zero equivalent — the S3 rubric
 * grades both as 0). The ad is still rendered, never dropped: scoring
 * zero ≠ product zero (the near-miss spectrum UX).
 *
 * P1 transaction direction (HumanTest S4, flaw #22): dealer «خریدار» ads
 * are competitors when the hunter wants sellers → sink like goods
 * (S4 rubric = 0, reason intent-inversion); when the hunter explicitly
 * wants to sell, the dealer IS a buyer → small boost instead.
 */
function scoreAd(
  ev: DescriptionEvaluation,
  mustCount: number,
  shouldCount: number,
  price: number | null
): { score: number; breakdown: ScoreBreakdown } {
  const title = mustCount > 0 ? ev.mustTitle / mustCount : 0;
  const description = mustCount > 0 ? ev.mustDesc / mustCount : 0;
  const priceKnown = price !== null ? 0.5 : 0;
  const shouldBoost = shouldCount > 0 ? (0.5 * ev.shouldMatched) / shouldCount : 0;
  const unknownPenalty = mustCount > 0 ? ev.missingInfo.length / mustCount : 0;
  const providerBoost = ev.providerHits > 0 ? 1 : 0;
  const nonServiceHits = ev.goodsHits + ev.needsRepairHits;
  const goodsPenalty = nonServiceHits > 0 && ev.providerHits === 0 ? 4 : 0;
  const dealerPenalty = ev.huntWantsSellers && ev.dealerHits > 0 ? 4 : 0;
  const dealerBoost = !ev.huntWantsSellers && ev.dealerHits > 0 ? 1 : 0;
  const breakdown: ScoreBreakdown = { title, description, priceKnown };
  return {
    score:
      3 * title +
      2 * description +
      priceKnown +
      shouldBoost -
      unknownPenalty +
      providerBoost -
      goodsPenalty -
      dealerPenalty +
      dealerBoost,
    breakdown,
  };
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
    rejectedNoMatch: 0,
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
  // NOTE: scored stays in FETCH order here (Divar lists are newest-first).
  // The ranking sort happens AFTER dedupe on purpose — see Phase 3.

  // ---- Phase 3: near-dup collapse (fetch order = newest first) ------------
  // Dedupe BEFORE the ranking sort (bug #19, round 4). The old code sorted
  // by titleStrength first, so "keep newest = first seen" was a lie — first
  // seen meant "highest titleStrength", and an older repost could shadow
  // the newer one. Now the first occurrence in fetch order (the newest
  // repost) wins, and ranking only orders the survivors.
  const { unique, dupsCollapsed } = collapseDupes(scored);
  stats.dupsCollapsed = dupsCollapsed;

  // Ranking sort AFTER dedupe — the newest repost already survived.
  unique.sort((a, b) => b.titleStrength - a.titleStrength);
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
  const mustCount = def.include.length;
  // Pre-#19 snapshots lack the SHOULD bucket — normalize, never crash.
  const shouldCount = def.should?.length ?? 0;
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
        if (detail.stale === true) {
          // Finding #1 (bug-bounty round 6): a stale detail is NOT verified
          // data — the detail API was down and this may be up to 60 min old
          // (price changed, ad deleted). Treating it as confirmed would let
          // the kamin baseline permanently consume an ad that was never
          // actually verified. Same path as a failed fetch: detailUnknown.
          detailUnknown = true;
        } else {
          description = detail.description;
        }
      } catch {
        // Invariant: failed detail = "unknown", never a silent drop.
        detailUnknown = true;
      }
      // Intent evaluation (flaw #19): MUST/SHOULD/MUST-NOT/UNKNOWN. A
      // failed/stale detail evaluates title-only (description = "") — the
      // ad is never silently dropped for a fetch failure; unmatched MUST
      // terms become UNKNOWN (missingInfo), not a rejection.
      const ev = evaluateDescription(description, c.title, def);
      if (ev.verdict === "rejected") {
        stats.rejectedNoMatch += 1;
        continue;
      }
      if (ev.verdict === "near") stats.nearMiss += 1;
      const { score, breakdown } = scoreAd(ev, mustCount, shouldCount, c.price);
      const ad: ScoredAd = {
        sourceAdId: c.sourceAdId,
        title: c.title,
        price: c.price,
        priceText: c.priceText,
        city: c.city,
        thumbnail: c.thumbnail,
        // Unknown details rank below verified ones (unchanged rule).
        score: detailUnknown ? score * 0.5 : score,
        breakdown,
        evidence: ev.evidence,
        // A failed/stale detail is never "exact" — the description was not
        // verified (spec §7). Honest ceiling: "near".
        matchKind: !detailUnknown && ev.verdict === "exact" ? "exact" : "near",
        missingInfo: ev.missingInfo,
        ...(detailUnknown ? { detailUnknown: true } : {}),
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
  // Exact matches outrank near-misses; near-misses order by score.
  results.sort((a, b) =>
    a.matchKind === b.matchKind
      ? b.score - a.score
      : a.matchKind === "exact"
        ? -1
        : 1
  );
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
