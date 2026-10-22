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
  type RoleMode,
} from "@/lib/interpret";
import {
  assessAbsencePolarity,
  assessBaitTitle,
  assessDemandGoods,
  assessListingRole,
  floorMatFlatbedConflict,
  assessModelSpecificity,
  assessQueryIntent,
  assessRepairPolarity,
  assessRepairService,
  assessServiceTarget,
  equipmentBeforeService,
  exclusionFires,
  isRepairWord,
  rolesClash,
} from "./semantics";
import {
  adKindForTitle,
  kindGateRejects,
  queryKindForDef,
  targetKindForDef,
} from "./kindLexicon";
import {
  adjudicateAd,
  huntTargetKinds,
  mizanWrongKindRejects,
  type MizanJudgment,
} from "./mizan";
import { dupKey } from "@/lib/nearDup";
import { flushSlugCaptures, type SlugCaptureStats } from "./slugCapture";
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
   *
   * R7 (2026-10-18): the query's speech-act role overrides the default
   * when the form didn't answer — bare «خریدار X» (roleMode "seek-buyer")
   * means the hunter is a seller looking for buyers (navid's R6 product
   * decision). See effectiveWantsSellers.
   */
  direction?: "buy" | "sell";
  /**
   * Speech-act role of the query (R7): whose ads the hunter wants.
   * Resolved in resolveHuntDefinition via detectRoleMode. Optional for
   * backward compatibility — absent means "none".
   */
  roleMode?: RoleMode;
  /**
   * Absent-attributes (R3, 2026-10-17): «بدون X» constraints from the query
   * («ماشین بدون رنگ» → ["رنگ"]). NOT excludes — a desired absence is a
   * condition: explicitly ABSENT in the ad satisfies, explicitly PRESENT
   * («رنگ شده») contradicts, UNKNOWN caps to near. Optional for backward
   * compatibility with pre-absent definitions — absent means none.
   */
  absentAttributes?: string[];
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

/**
 * R7 (2026-10-18): which side of the market the hunt wants.
 * The query's speech-act role decides (bare «خریدار X» = seek-buyer →
 * wants buyers); otherwise the default ("buy" — the common hunter is a
 * buyer).
 *
 * R7-redteam: def.direction was never set by any code path (no form,
 * route, or definition ever assigned it) — the "explicit form wins"
 * branch was dead code asserting a fiction. roleMode is the single live
 * authority (navid's R6 product decision).
 */
export function effectiveWantsSellers(def: HuntDefinition): boolean {
  const mode = def.roleMode ?? "none";
  if (mode === "seek-buyer" || mode === "self-seller") return false;
  return true;
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
  /**
   * R5 (2026-10-17): first ~200 chars of the ad description,
   * whitespace-collapsed — lets a human grader verify condition claims
   * («بدون رنگ») the engine read from the description. Display-only;
   * never scored.
   */
  descSnippet?: string;
  /**
   * R12b (double-check F3): why this ad was capped to "near" by a demote
   * rule (bait / demand-goods / kind-gate / semantic cap). Without the
   * label, demoted firings are invisible in battery output and the rules
   * can never be re-derived from real firing text. Display/audit only.
   */
  demotedBy?: "bait" | "demand-goods" | "kind" | "cap";
  /**
   * Step 0.5 (Smart Engine Plan v5): Divar's leaf category for this ad,
   * copied verbatim from the verified detail. Carried on the result so
   * downstream consumers (knowledge layer, harvest gap analysis) stop
   * re-deriving what the provider already told us. Absent when the
   * detail was stale/failed or carried no slug.
   */
  categorySlug?: string;
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
  /**
   * R7 (2026-10-18): two-directional measurement (DeepSeek blind spot) —
   * a sample of REJECTED ads (title + rejection kind) for the
   * false-rejection audit. Every round graded only the shown results
   * (false positives); nothing measured good ads killed by the rules.
   * Capped at 12/hunt, first-rejected-first (candidates are processed in
   * title-strength order, so these are the most likely false rejections).
   * The grading packet renders them for parallel grading.
   */
  // R12: descSnippet (first 200 chars) rides along — the R11 audit found
  // 18/19 bait+demand-goods rejections wrong but could not trace WHY:
  // rejected samples stored no description, so the firing text was lost.
  // Never audit blind again.
  rejectedSample: Array<{
    title: string;
    kind: string;
    price: number | null;
    descSnippet?: string;
  }>;
  /**
   * Mizan judgments, log-only (R9 shadow → R10–R12 active → Decision v2
   * log-only again, 2026-10-20). Each entry: the ad, Mizan's judgment,
   * what the deterministic engine decided, and the would-be rejection
   * features. Nothing here ever modifies results.
   */
  mizanShadow: Array<{
    title: string;
    judgment: MizanJudgment;
    deterministicVerdict: "near" | "exact";
    latencyMs: number;
    /**
     * Decision v2 (2026-10-20): what the R10–R12 rules WOULD have
     * rejected. Features for the learned ranker — never applied.
     */
    wouldRejectWrongKind?: boolean;
    wouldRejectViolation?: boolean;
  }>;
  /**
   * Count of ads actually rejected by Mizan. Decision v2 revoked
   * Mizan's deletion authority, so this stays 0; would-be decisions
   * live in mizanShadow as features. Kept for stats-shape compatibility.
   */
  mizanRejected: number;
  /**
   * Step 0.5 (Smart Engine Plan v5): breadcrumb-capture outcome for this
   * run — how many (ad, leaf-category) pairs were persisted, buffered
   * (no DB configured), or lost. Fail-open by design: a capture failure
   * never affects results, but it is always counted here so corpus
   * completeness is measurable instead of silently assumed.
   */
  slugCapture?: SlugCaptureStats;
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
  /**
   * R7 (2026-10-18): the ad's speech-act stance from assessListingRole
   * ("product" | "buyer-seeking" | "service" | "rental" | "exchange" |
   * "unknown"). Powers the wrong-side demote: a clear offer ad on a
   * buyer-seeking hunt sinks like a dealer ad does on a seller-seeking
   * hunt (rank penalty, never a hard drop — most ads are role-silent).
   */
  adRole: string;
  /**
   * R6 (2026-10-17): why a wrong-item ad was rejected
   * (part:offering:"…", seeker:…, bait:…, demand-goods:…). Feeds the
   * «گزارش شکار» market report ("X ads seen but not your item") — no
   * silent filtering. Set only on wrong-item rejections.
   */
  rejectedKind?: string;
  /**
   * R12b (double-check F3): which demote rule capped this ad to "near"
   * ("bait" | "demand-goods" | "kind" | "cap"). Set only on demote
   * branches; carried onto ScoredAd so battery audits can find firings.
   */
  demotedBy?: "bait" | "demand-goods" | "kind" | "cap";
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
    adRole: "unknown",
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
 *
 * R6 (2026-10-17): also surfaces wrongItemKind — a tier-"reject" identity
 * mismatch (the ad IS the wrong item: part, accessory, derived, seeker…)
 * rejects the ad instead of capping it to near (navid's R5 product
 * decision: 0 = wrong item, not shown). Same-item near-misses
 * (sibling-variant, unknown attributes) keep tier "near".
 */
function semanticCapFires(
  def: HuntDefinition,
  combined: string,
  title: string
): { fire: boolean; wrongItemKind: string | null } {
  let intent = assessQueryIntent(def.include.join(" "), def.category, def.transaction);
  // R7 (2026-10-18): the query's speech-act role IS the query intent. A
  // bare «خریدار X» hunt seeks buyer ads — so a buyer-seeking ad is
  // compatible (no clash), and a clear offer ad clashes (capped to near,
  // like dealer ads on seller-seeking hunts). The role word was stripped
  // from include by design (R4), so the intent assessor never sees it —
  // the resolved roleMode carries it instead.
  const roleMode = def.roleMode ?? "none";
  if (roleMode === "seek-buyer" || roleMode === "self-seller") {
    intent = { role: "buyer-seeking", reason: "query-role-mode:seek-buyer" };
  }
  const role = assessListingRole(combined);
  const explicitBuy =
    def.transaction === "buy" || detectTransaction(def.query) === "buy";
  const clash = rolesClash(intent, role, explicitBuy);
  // R8 (F2): the hunt's subject kind for the kind-aware marker guard
  // (sibling markers of the same kind are co-offered, not wrong items).
  const qKind = queryKindForDef(def.include, def.serviceIntent ?? false, def.category);
  const identity = clash.clash
    ? { mismatch: false as const, reason: "skipped:role-clash", tier: "near" as const }
    : assessModelSpecificity(def.include, combined, def.category, qKind, def.query, title);
  // R3 (2026-10-17): absent-attributes generalize the repair polarity
  // rule — «بدون رنگ» with no paint info is unknown, capped at near
  // (never exact); the نه-sourced repair rule is preserved as-is.
  // R7 (2026-10-18): present-implied counter-evidence («دور رنگ» for
  // «بدون تصادف») defeats exactness the same way — capped to near.
  const absentNotExact = (def.absentAttributes ?? []).some((a) => {
    const p = assessAbsencePolarity(combined, a).polarity;
    return p === "unknown" || p === "implied";
  });
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
  // R3 (2026-10-17): equipment-before-service — «فروش فوری تجهیزات
  // تخصصی تعمیرات موبایل» sells equipment, it doesn't offer the service.
  const equipmentMismatch =
    serviceIntent && equipmentBeforeService(combined);
  const targetBound =
    !serviceIntent ||
    assessServiceTarget(def.include, combined, def.category).bound;
  const fire =
    clash.clash ||
    identity.mismatch ||
    absentNotExact ||
    repairUnknown ||
    needsRepairMismatch ||
    unsupportedServiceExact ||
    equipmentMismatch ||
    !targetBound;
  // R6: wrong-item rejection kind for the verdict stage (null unless the
  // identity mismatch fired at tier "reject").
  const wrongItemKind =
    identity.mismatch && identity.tier === "reject" ? identity.reason : null;
  return { fire, wrongItemKind };
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
  def: HuntDefinition,
  /**
   * R7 (P1): Divar's leaf category slug for the ad (from the detail
   * fetch). R7-redteam P0: no longer a hard-gate source — as the SOLE kind
   * signal for unknown heads it mass-rejected home hunts and buyer ads.
   * Kept plumbed (not fetched-then-dropped) for a future soft-demote
   * signal; the gate fires on head-kind only.
   */
  categorySlug: string = ""
): DescriptionEvaluation {
  const combined = `${title} ${description}`;
  // E3: do not let an explicit trailer/flatbed listing survive as a near
  // match for the floor-mat sense of «کفی ماشین». This guard is query-scoped
  // and runs before MUST completeness, because many wrong-kind ads match
  // only «کفی» and would otherwise remain eligible as partial matches.
  const floorMatConflict = floorMatFlatbedConflict(def.query, title, description);
  if (floorMatConflict) return rejectedEvaluation(floorMatConflict);
  // 1. MUST_NOT — «نه» means نه, with repair-word polarity scoping (an
  // explicit «بدون تعمیر» listing satisfies a no-repair request instead of
  // being banned by its own vocabulary).
  for (const term of def.exclude) {
    if (exclusionFires(combined, term, def.category)) {
      return rejectedEvaluation();
    }
  }
  // 1b. Absent-attributes («بدون رنگ») — R3 inversion fix. An explicit
  // presence-contradiction («رنگ شده») rejects the ad; anything else
  // flows on (absent satisfies below, unknown caps to near in the
  // semantic layer). Never a lexical ban: «بدون رنگ» must not murder
  // «پراید … بدون رنگ».
  const absentAttrs = def.absentAttributes ?? [];
  for (const attr of absentAttrs) {
    if (assessAbsencePolarity(combined, attr).polarity === "present") {
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
  // when the hunter wants to sell. R7: the query's speech-act role
  // overrides the default when the form didn't answer (bare «خریدار X»).
  const huntWantsSellers = effectiveWantsSellers(def);
  const dealerHits = countDealerHits(combined);
  // R7: the ad's speech-act stance — a clear offer ad on a buyer-seeking
  // hunt is the mirror of a dealer ad on a seller-seeking hunt.
  const adRole = assessListingRole(combined).role;
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
    adRole,
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
  // 3b. Satisfied absent-attributes join the evidence — «چرا این آگهی؟»
  // should show the condition («بدون رنگ»), not just the item. Polarity
  // was already checked for contradictions in 1b; absent here means the
  // ad explicitly evidences the desired absence. A synonym bridge
  // («بی رنگ» ⇒ «بدون تصادف») is disclosed, not silently claimed.
  for (const attr of absentAttrs) {
    const r = assessAbsencePolarity(combined, attr);
    if (r.polarity === "absent") {
      const viaPrefix = "absence-absent-via-synonym:";
      const via = r.reason.startsWith(viaPrefix)
        ? ` (از: بدون ${r.reason.slice(viaPrefix.length)})`
        : "";
      evidence.push(`بدون ${attr}${via}`);
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
  //
  // R6 (2026-10-17): wrong-item ads (the ad IS a part / accessory /
  // derived product / seeker ad / bait / goods-ad-on-a-demand-hunt) are
  // REJECTED, not capped to near — navid's R5 product decision (0 = wrong
  // item, not shown). Same-item near-misses (sibling-variant, unknown
  // attributes) keep the honest near spectrum. Every rejection carries
  // its kind for the «گزارش شکار» market report.
  if (missingInfo.length === 0) {
    const cap = semanticCapFires(def, combined, title);
    const bait = assessBaitTitle(title, description, def.include, def.query);
    const demandGoods =
      (def.serviceIntent ?? false) &&
      assessDemandGoods(def.include, combined);
    // R7 (P1): subject-kind reconciliation — structural wrong-item rejection.
    // R7-redteam P0: Divar's category slug no longer hard-gates — it was the
    // SOLE kind source for unknown heads and mass-rejected home hunts («میز»)
    // and the «خریدار یخچال» buyer ads. Unknown head → no gate.
    // R7-redteam P1: on service hunts the gate compares against the service
    // TARGET («یخچال تعمیر» must not kill «تعمیر یخچال در محل»).
    const qKind = queryKindForDef(def.include, def.serviceIntent ?? false, def.category);
    const svcHunt = (def.serviceIntent ?? false) || qKind === "service";
    const kindVerdict = kindGateRejects(
      qKind,
      adKindForTitle(title),
      svcHunt ? targetKindForDef(def.include) : null,
      svcHunt
    );
    const kindReject = kindVerdict?.tier === "reject" ? kindVerdict.reason : null;
    const kindDemote = kindVerdict?.tier === "demote" ? kindVerdict.reason : null;
    const wrongKind = cap.wrongItemKind ?? kindReject;
    if (wrongKind) {
      return {
        ...rejectedEvaluation(),
        missingInfo,
        providerHits,
        goodsHits,
        needsRepairHits,
        dealerHits,
        huntWantsSellers,
    adRole,
        rejectedKind: wrongKind,
      };
    }
    // R12 (desc-level audit): bait + demand-goods DEMOTED from reject to
    // near. The R11 audit (161 human-graded rejects) found 18 of their 19
    // sampled rejections WRONG (every one grade 3): bait 11/11,
    // demand-goods 7/8 — over half of ALL wrong rejections in R11. A rule
    // whose measured output is only misses may not reject — doubt = keep,
    // the engine's own law. The rules still fire as a cap (never exact)
    // until the R12 battery — which now stores rejected descriptions —
    // lets us re-derive them from real firing text, not guesses.
    if (bait || demandGoods) {
      return {
        demotedBy: bait ? "bait" : "demand-goods",
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
    adRole,
      };
    }
    // R8 (F4a): demote — right area, wrong role. Capped to near, never
    // exact, never rejected («امداد باطری ماشین» on a battery hunt is a
    // battery source, not a wrong item).
    if (kindDemote) {
      return {
        demotedBy: "kind",
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
    adRole,
      };
    }
    if (cap.fire) {
      return {
        demotedBy: "cap",
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
    adRole,
      };
    }
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
    adRole,
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
  // R7 (2026-10-18): mirror of the dealer penalty — a clear offer
  // ("product" stance) ad on a buyer-seeking hunt is the wrong side of
  // the market. Rank penalty only, never a hard drop: most ads are
  // role-silent ("unknown") and stay fully compatible.
  const offerPenalty = !ev.huntWantsSellers && ev.adRole === "product" ? 4 : 0;
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
      dealerPenalty -
      offerPenalty +
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
    rejectedSample: [],
    mizanShadow: [],
    mizanRejected: 0,
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
  // Decision v2 sec.5.2 experiment knob: HUNT_MAX_DETAILS overrides the
  // per-hunt detail cap (used by the Snapshot v1 50/50 dual-query split).
  // Unset/invalid in production — the constant rules. shortcut: env-only,
  // no per-request plumbing; remove when the retrieval experiment closes.
  const envCap = Number(process.env.HUNT_MAX_DETAILS);
  const detailCap =
    Number.isFinite(envCap) && envCap > 0 ? envCap : MAX_DETAILS_PER_HUNT;
  const toCheck = candidates.slice(0, detailCap);
  // Step 0.5: breadcrumb pairs from FRESH details only (a stale detail's
  // slug is unverified data — the same invariant that marks it
  // detailUnknown). Flushed once at the end of this function, fail-open.
  const slugPairs = new Map<string, string>();
  const mustCount = def.include.length;
  // Pre-#19 snapshots lack the SHOULD bucket — normalize, never crash.
  const shouldCount = def.should?.length ?? 0;
  const results: ScoredAd[] = [];
  const confirmed: ScoredAd[] = [];

  // R12 (judge-after-rank): collect judge data for EVERY surviving
  // candidate here; the queue itself is built AFTER the Phase-5 sort,
  // from the final ranked list. R9-R11 built the queue in arrival order
  // (cap 12) — the coverage hole: on H8 only 4 of 91 results were ever
  // judged, and unjudged wrong ads ranked into the top-10 untouched.
  const judgeData = new Map<
    string,
    {
      title: string;
      description: string;
      deterministicVerdict: "near" | "exact";
    }
  >();
  const huntKind =
    queryKindForDef(def.include, def.serviceIntent ?? false, def.category ?? "") ??
    "general";
  // Build Noul constraint from absentAttributes (e.g. "بدون رنگ" hunts)
  const constraintFa =
    def.absentAttributes && def.absentAttributes.length > 0
      ? `این آگهی نباید این ویژگی‌ها را داشته باشد: ${def.absentAttributes.join("، ")}`
      : null;

  for (let i = 0; i < toCheck.length; i += DETAIL_BATCH) {
    const batch = toCheck.slice(i, i + DETAIL_BATCH);
    const batchConfirmed: ScoredAd[] = [];
    for (const c of batch) {
      stats.detailsChecked += 1;
      let description = "";
      let detailUnknown = false;
      let categorySlug = "";
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
          // R7 (P1): the provider's leaf category corroborates the ad's
          // subject kind when the title head is unknown.
          categorySlug = detail.categorySlug ?? "";
          if (categorySlug) slugPairs.set(c.sourceAdId, categorySlug);
        }
      } catch {
        // Invariant: failed detail = "unknown", never a silent drop.
        detailUnknown = true;
      }
      // Intent evaluation (flaw #19): MUST/SHOULD/MUST-NOT/UNKNOWN. A
      // failed/stale detail evaluates title-only (description = "") — the
      // ad is never silently dropped for a fetch failure; unmatched MUST
      // terms become UNKNOWN (missingInfo), not a rejection.
      const ev = evaluateDescription(description, c.title, def, categorySlug);
      if (ev.verdict === "rejected") {
        stats.rejectedNoMatch += 1;
        // R7: feed the false-rejection audit — sample the rejects.
        if (stats.rejectedSample.length < 12) {
          stats.rejectedSample.push({
            title: c.title,
            kind: ev.rejectedKind ?? "no-match",
            price: c.price,
            descSnippet: description.replace(/\s+/g, " ").trim().slice(0, 200),
          });
        }
        continue;
      }
      if (ev.verdict === "near") stats.nearMiss += 1;
      // R11: judge BOTH "near" AND "exact" candidates.
      // R10 bug: only "near" was queued — stupid ads the deterministic
      // engine confidently called "exact" (e.g. «لوازم ماشین» on a car
      // hunt) never reached Mizan. R12: no arrival-order cap here — the
      // queue is cut from the ranked list below.
      if ((ev.verdict === "near" || ev.verdict === "exact") && !detailUnknown) {
        judgeData.set(c.sourceAdId, {
          title: c.title,
          description,
          deterministicVerdict: ev.verdict,
        });
      }
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
        // R12b (F3): carry the demote label onto the result card data.
        ...(ev.demotedBy ? { demotedBy: ev.demotedBy } : {}),
        // R5 grading packets show this so condition claims are verifiable.
        descSnippet: description.replace(/\s+/g, " ").trim().slice(0, 200),
        // Step 0.5: carry the verified leaf category on the result.
        ...(categorySlug ? { categorySlug } : {}),
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

  // ---- Phase 5: ranking (R12: moved BEFORE the Mizan block) ---------------
  // Exact matches outrank near-misses; near-misses order by score.
  results.sort((a, b) =>
    a.matchKind === b.matchKind
      ? b.score - a.score
      : a.matchKind === "exact"
        ? -1
        : 1
  );

  // R12 judge-after-rank: the judge queue is the top of the FINAL ranked
  // list (visible zone + backfill margin), not the first arrivals.
  // The 60s wall-clock budget in the block below still bounds total calls.
  const JUDGE_AFTER_RANK_CAP = 24;
  const mizanQueue: Array<{
    title: string;
    description: string;
    deterministicVerdict: "near" | "exact";
    sourceAdId: string;
  }> = [];
  for (const r of results) {
    if (mizanQueue.length >= JUDGE_AFTER_RANK_CAP) break;
    const jd = judgeData.get(r.sourceAdId);
    if (jd) mizanQueue.push({ ...jd, sourceAdId: r.sourceAdId });
  }

  // ---- Mizan judging — LOG-ONLY (Decision v2, 2026-10-20) ----------------
  // Mizan judges the ranked queue and its would-be decisions are recorded
  // as features in stats.mizanShadow. It deletes NOTHING: Decision v2 §3
  // revoked judge deletion authority (R11 audit: 20% of graded rejections
  // were misses). The R10–R12 predicates below still compute what Mizan
  // WOULD have rejected — that is the feature, and the baseline for any
  // §3 reinstatement trial. Deterministic results are never modified here.
  //
  // SKIP in test environment: no Mizan server in vitest, and the 30s
  // fetch timeout would make tests hang. Production/dev only.
  //
  // Kill-switch + wall-clock budget: if Mizan is slow or wedged, we stop
  // dispatching and the deterministic results stand.
  // Set MIZAN_SHADOW=0 to disable entirely.
  const isTestEnv =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const shadowDisabled = process.env.MIZAN_SHADOW === "0";
  const SHADOW_BUDGET_MS = 60000; // 60s wall-clock max for the shadow block
  // The hunt's own target kinds (R12) — judgments naming these would
  // never have rejected (see huntTargetKinds in mizan.ts; the R11
  // wrong-rejection hole). Still computed: they define the would-be
  // features and sit above any future §3 reinstatement channel.
  // R12b: the threshold + predicate live in mizan.ts
  // (MIZAN_WRONG_KIND_CONF / mizanWrongKindRejects) — one source, tested.
  const targetKinds = huntTargetKinds(
    huntKind,
    def.serviceIntent ?? false,
    def.include ?? []
  );
  if (mizanQueue.length > 0 && !isTestEnv && !shadowDisabled) {
    const shadowStart = Date.now();
    for (const q of mizanQueue) {
      // Budget check: stop if we've exceeded the wall-clock budget.
      // Deterministic results stand; we just get fewer judgments.
      if (Date.now() - shadowStart > SHADOW_BUDGET_MS) break;
      const t0 = Date.now();
      try {
        const judgment = await adjudicateAd(
          q.title,
          q.description,
          huntKind,
          constraintFa
        );
        // Would-be features (Decision v2): what the R10–R12 rules WOULD
        // have rejected — computed and logged, never applied.
        // Wrong-kind: mizanWrongKindRejects encodes the R12 generalized
        // hunt-intent guard (a judgment naming the hunt's own target kind
        // never rejected — R11's 13 wrong rejections) and the R12b
        // title-evidence shield (a title evidencing every MUST term of a
        // multi-term hunt IS the hunted item by the engine's own
        // evidence; a model kind label cannot overrule it).
        const titleEvidencesHunt =
          (def.include?.length ?? 0) >= 2 &&
          (def.include ?? []).every((t) => textMatches(q.title, t));
        const wouldRejectWrongKind = mizanWrongKindRejects(
          judgment,
          targetKinds,
          titleEvidencesHunt
        );
        // Violation: Noul >= 0.8 WITH deterministic corroboration — the
        // deterministic engine must ALSO see a forbidden attribute as
        // "present" (assessAbsencePolarity). This protected
        // negated/favourable mentions Noul misreads
        // («تصادف نداشته», «رنگ اصلی کارخانه»).
        const NOUL_REJECT_PROB = 0.8;
        const hasDetConflict = (def.absentAttributes ?? []).some(
          (attr) =>
            assessAbsencePolarity(`${q.title} ${q.description}`, attr)
              .polarity === "present"
        );
        const wouldRejectViolation =
          judgment.violates === true &&
          judgment.violateProbability >= NOUL_REJECT_PROB &&
          hasDetConflict &&
          !judgment.unavailable;
        stats.mizanShadow.push({
          title: q.title,
          judgment,
          deterministicVerdict: q.deterministicVerdict,
          latencyMs: Date.now() - t0,
          wouldRejectWrongKind,
          wouldRejectViolation,
        });
      } catch {
        // Mizan failure must never break the hunt. Log and continue.
        stats.mizanShadow.push({
          title: q.title,
          judgment: {
            itemKind: null,
            itemConfidence: 0,
            violates: null,
            violateProbability: 0,
            actionable: false,
            unavailable: true,
          },
          deterministicVerdict: q.deterministicVerdict,
          latencyMs: Date.now() - t0,
          wouldRejectWrongKind: false,
          wouldRejectViolation: false,
        });
      }
    }
  }

  // Step 0.5: persist the breadcrumb pairs (fail-open, counted in stats).
  // Runs after ranking/judging, on already-computed results — capture is
  // observation-only and can never change what the user sees.
  stats.slugCapture = await flushSlugCaptures(slugPairs);
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
