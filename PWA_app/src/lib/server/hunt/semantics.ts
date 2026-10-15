import "server-only";

import {
  expandSynonyms,
  normalizeForMatch,
  stemToken,
  textMatches,
} from "@/lib/persianNormalize";
import { includesWord } from "@/lib/interpret";

/**
 * Phase-1 semantic assessments (deterministic, rule-based).
 *
 * Purpose: distinguish LEXICAL overlap, LISTING ROLE, PRODUCT IDENTITY and
 * ATTRIBUTE POLARITY inside the existing hunt pipeline without changing its
 * public contracts (`matchKind: "exact" | "near"`, `missingInfo`,
 * `detailUnknown`, candidate status). Every assessment returns a brief
 * reason so tests and debugging can establish WHY it fired.
 *
 * Design rules:
 * - Deterministic bounded phrase dictionaries only. No probabilistic
 *   classification, no external model.
 * - Unknown stays unknown: a confident verdict requires explicit evidence.
 *   Ambiguous text never contradicts and never satisfies.
 * - All matching normalizes with `normalizeForMatch` (Arabic-keyboard
 *   variants, ZWNJ, punctuation), consistent with the rest of the system.
 */

/** What a listing offers or seeks — assessed from title + description. */
export type ListingRole =
  | "product"
  | "service"
  | "buyer-seeking"
  | "rental"
  | "exchange"
  | "unknown";

/** What the hunter wants — assessed from the query (plus category/transaction). */
export type QueryIntent = ListingRole;

export interface RoleAssessment {
  readonly role: ListingRole;
  /** Brief provenance, e.g. `service-phrase:"در محل"`. */
  readonly reason: string;
}

/** Repair-history polarity of a listing text for scoped negative attributes. */
export type RepairPolarity = "absent" | "present" | "unknown";

/** Normalized repair words that may carry a scoped absence request. */
const REPAIR_WORDS = new Set(["تعمیر", "تعمیرات"]);

/** True when an exclude term is a repair word needing polarity scoping. */
export function isRepairWord(term: string): boolean {
  return REPAIR_WORDS.has(normalizeForMatch(term));
}

/**
 * Filler tokens inside repair patterns: any word EXCEPT repair-scope words
 * themselves. Without the guard, «بدون تعمیر ولی تعمیر شده» would match as
 * one absent span and swallow a genuine conflict.
 */
const FILLER = String.raw`((?:\s+(?!تعمیر|بدون|نشده|شده)\S+)){0,2}`;

/**
 * Explicit repair-ABSENT markers (the listing states no repair history).
 * Checked on normalized text, so ZWNJ/spelling variants behave uniformly.
 * The بدون-pattern tolerates up to two filler tokens («بدون هیچ تعمیری»,
 * «بدون رنگ و تعمیر»).
 */
const REPAIR_ABSENT_RES: readonly RegExp[] = [
  new RegExp(`بدون${FILLER}\\s+تعمیر(ات|ی)?`),
  /تعمیر(ات)?\s+نشده/,
  /تعمیرنشده/,
  /تعمیر\s+نکرده/,
];

/**
 * Explicit repair-PRESENT markers (the listing states a repair happened or
 * is needed). A bare «تعمیر» is deliberately NOT here: the word alone is
 * not proof of repair history (it may name a service offer instead).
 */
const REPAIR_PRESENT_RES: readonly RegExp[] = [
  new RegExp(`تعمیر(ات)?${FILLER}\\s+شده`),
  /تعمیرشده/,
  /تعمیری/,
  /نیاز\s+به\s+تعمیر/,
];

/**
 * Assess repair-history polarity. Conflicting marks (both absent and
 * present phrasing) resolve to unknown — never invent evidence.
 */
export function assessRepairPolarity(text: string): {
  readonly polarity: RepairPolarity;
  readonly reason: string;
} {
  const norm = normalizeForMatch(text);
  if (norm === "") return { polarity: "unknown", reason: "empty-text" };
  const absentHit = REPAIR_ABSENT_RES.find((re) => re.test(norm))?.source ?? null;
  if (!absentHit) {
    const presentOnly = REPAIR_PRESENT_RES.find((re) => re.test(norm))?.source ?? null;
    if (presentOnly) return { polarity: "present", reason: `repair-present:${presentOnly}` };
    return { polarity: "unknown", reason: "no-repair-polarity-mark" };
  }
  // An absent span (e.g. «بدون هیچ تعمیری») owns its words: a present
  // marker inside the same span («تعمیری») is the absence claim itself,
  // not counter-evidence. Present markers OUTSIDE the absent span mean
  // genuinely conflicting marks → unknown.
  let remainder = ` ${norm} `;
  for (const re of REPAIR_ABSENT_RES) {
    remainder = remainder.replace(new RegExp(re.source, "g"), " ");
  }
  remainder = remainder.replace(/\s+/g, " ").trim();
  const presentHit = REPAIR_PRESENT_RES.find((re) => re.test(remainder))?.source ?? null;
  if (presentHit) {
    return { polarity: "unknown", reason: "conflicting-repair-marks" };
  }
  return { polarity: "absent", reason: `repair-absent:${absentHit}` };
}

/**
 * Scoped exclusion check for MUST_NOT terms.
 *
 * Generic behavior is preserved: a lexically matching term fires, otherwise
 * it does not. The single exception is repair words, which follow polarity:
 * - explicitly ABSENT («بدون تعمیر»): the ban does not fire — rejecting
 *   that listing would punish the exact evidence the hunter asked for;
 * - explicitly PRESENT («تعمیر شده»): the ban fires (contradiction);
 * - UNKNOWN (no mark, bare mention, or conflicting marks): the ban does
 *   NOT fire either. A mere occurrence of «تعمیر» never establishes repair
 *   history, so it must not reject. Unknown polarity is capped at near by
 *   the verdict stage instead — preserved, never exact.
 */
export function exclusionFires(
  text: string,
  term: string,
  category?: string
): boolean {
  if (!textMatches(text, term, category)) return false;
  if (isRepairWord(term)) {
    return assessRepairPolarity(text).polarity === "present";
  }
  return true;
}

/** Buyer-seeking subject words: explicit only at the START of the text. */
const BUYER_SUBJECT_FIRST = new Set(["خریدار", "خریدارم", "خواهان", "متقاضی"]);

/**
 * Buyer markers that are unambiguous anywhere in the text. A bare «خریدار»
 * mid-text is deliberately excluded («فروش به خریدار واقعی» is a product
 * listing, not a wanted-to-buy ad).
 */
const BUYER_ANYWHERE = ["خواهان", "متقاضی", "جویای", "به دنبال", "می خرم", "میخرم"];

/** Shop-style service offers — the business itself, not a product feature. */
const SERVICE_SHOP = ["تعمیرات", "تعمیرگاه", "سرویسکار"];

/**
 * Context words that turn a bare «تعمیر» into a service offer
 * («تعمیر یخچال در محل»). Bare «خدمات» is intentionally absent: it is
 * ambiguous between an offer and an after-sales product feature.
 */
const SERVICE_CONTEXT = [
  "در محل",
  "سیار",
  "منزل",
  "محل شما",
  "انواع",
  "تضمینی",
  "فوری",
  "شبانه روزی",
  "سرویس",
  "نصب",
  "عیب یابی",
  "راه اندازی",
];

const RENTAL_WORDS = ["اجاره", "رهن"];
const EXCHANGE_PHRASES = ["معاوضه", "تعویض", "فروش عمده", "عمده", "همکار", "بنکدار", "پخش کننده"];
const SALE_CUES = ["فروش", "فروشی", "میفروشم", "می فروشم", "فروش فوری", "قیمت", "تخفیف", "سند آماده"];

/**
 * Remove spans that already carry repair-polarity meaning, so «بدون تعمیر»
 * and «تعمیر شده» never count as service-offer evidence for «تعمیر».
 */
function stripRepairPolaritySpans(normalized: string): string {
  let out = ` ${normalized} `;
  for (const re of [...REPAIR_ABSENT_RES, ...REPAIR_PRESENT_RES]) {
    out = out.replace(new RegExp(re.source, "g"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function firstToken(normalized: string): string {
  return normalized.split(" ").filter(Boolean)[0] ?? "";
}

/**
 * Assess what a listing offers or seeks. Confident roles require explicit
 * cue phrases; everything else is unknown (recall-preserving).
 */
export function assessListingRole(text: string): RoleAssessment {
  const norm = normalizeForMatch(text);
  if (norm === "") return { role: "unknown", reason: "empty-text" };

  // Explicit wanted-to-buy subject («خریدار یخچال …»).
  const first = firstToken(norm);
  if (BUYER_SUBJECT_FIRST.has(first)) {
    return { role: "buyer-seeking", reason: `buyer-subject:"${first}"` };
  }

  // Shop-style service business («تعمیرات یخچال …»).
  const shop = SERVICE_SHOP.find((p) => includesWord(norm, p));
  if (shop) return { role: "service", reason: `service-shop:"${shop}"` };

  // Rental and exchange cues are lexically unambiguous.
  const rental = RENTAL_WORDS.find((w) => norm.includes(w));
  if (rental) return { role: "rental", reason: `rental-cue:"${rental}"` };
  const exchange = EXCHANGE_PHRASES.find((p) => norm.includes(p));
  if (exchange) return { role: "exchange", reason: `exchange-cue:"${exchange}"` };

  // Bare «تعمیر» is service evidence only with offer context or offer
  // phrasing («تعمیر X» up front). Repair-history spans were stripped
  // above, so «تعمیر شده» / «بدون تعمیر» cannot reach this branch.
  const stripped = stripRepairPolaritySpans(norm);
  if (includesWord(stripped, "تعمیر")) {
    const ctx = SERVICE_CONTEXT.find((p) => stripped.includes(p));
    if (ctx) return { role: "service", reason: `service-context:"${ctx}"` };
    const tokens = stripped.split(" ").filter(Boolean);
    if (tokens[0] === "تعمیر" || tokens[1] === "تعمیر") {
      return { role: "service", reason: "service-offer-phrasing" };
    }
  }

  // Unambiguous buyer markers anywhere («خواهان …», «به دنبال …»).
  const buyer = BUYER_ANYWHERE.find((p) => norm.includes(p));
  if (buyer) return { role: "buyer-seeking", reason: `buyer-cue:"${buyer}"` };

  // A confident product offer needs a sale cue and no competing role cue.
  const sale = SALE_CUES.find((p) => norm.includes(p));
  if (sale) return { role: "product", reason: `sale-cue:"${sale}"` };

  return { role: "unknown", reason: "no-role-cue" };
}

/**
 * Assess what the hunter wants. Query text uses the same cue vocabulary as
 * listings; a bare product query implies a product intent ONLY when the
 * category context is reliable. Otherwise the intent is unknown and no
 * role clash can fire.
 */
export function assessQueryIntent(
  query: string,
  category: string,
  transaction: "" | "rent" | "buy"
): RoleAssessment {
  if (transaction === "rent") return { role: "rental", reason: "transaction:rent" };
  if (transaction === "buy") return { role: "product", reason: "transaction:buy" };
  const textRole = assessListingRole(query);
  if (textRole.role !== "unknown" && textRole.role !== "product") {
    return { role: textRole.role, reason: `query-${textRole.reason}` };
  }
  if (textRole.role === "product") {
    return { role: "product", reason: `query-${textRole.reason}` };
  }
  if (category !== "" && category !== "all") {
    return { role: "product", reason: "implied-product:clear-category" };
  }
  return { role: "unknown", reason: "ambiguous-query" };
}

/**
 * Whether a confident query intent and a confident listing role contradict.
 * Either side unknown → no clash (preserve, never invent a contradiction).
 *
 * Two deliberate exceptions keep recall stable:
 * - an implied product intent (bare query + category) does not clash with
 *   rental listings unless the hunter explicitly asked to buy;
 * - a service query does not clash with a plain product listing (the MUST
 *   terms already decide: a product ad lacking «تعمیر» is near, not exact).
 */
export function rolesClash(
  query: RoleAssessment,
  listing: RoleAssessment,
  explicitBuy: boolean
): { readonly clash: boolean; readonly reason: string } {
  if (query.role === "unknown" || listing.role === "unknown") {
    return { clash: false, reason: "unknown-side" };
  }
  if (query.role === listing.role) {
    return { clash: false, reason: "role-compatible" };
  }
  if (query.role === "product" && listing.role === "rental" && !explicitBuy) {
    return { clash: false, reason: "rental-needs-explicit-buy" };
  }
  if (query.role === "service" && listing.role === "product") {
    return { clash: false, reason: "service-relies-on-must-terms" };
  }
  return {
    clash: true,
    reason: `role-clash:query=${query.role}:listing=${listing.role}`,
  };
}

/**
 * Offered-service vs needs-repair signal (Phase 1.3).
 *
 * A listing that NEEDS repair («نیاز به تعمیر دارد») is a product with a
 * condition disclosure — not a technician offering service. Conversely, a
 * service ad that mentions a broken customer item is still an offer.
 * Neither bare «تعمیر» nor damage words alone decide: confident markers
 * on both sides (or on neither side) resolve to unknown_or_mixed, which
 * preserves the candidate and lets the existing role logic decide.
 */
export type RepairServiceSignal = "service_offered" | "item_needs_repair" | "unknown_or_mixed";

/**
 * Item-condition markers: the PRODUCT itself needs repair. «بدون نیاز به
 * تعمیر» (no repair needed = good condition) is explicitly excluded by the
 * بدون-guard — it must never read as damage.
 */
const NEEDS_REPAIR_RES: readonly RegExp[] = [
  /نیاز\s+به\s+تعمیر/,
  /نیازمند\s+تعمیر/,
  /باید\s+تعمیر\s+شو(د|ند)/,
  /تعمیر\s+لازم\s+(دارد|است|هست)/,
  /احتیاج\s+به\s+تعمیر/,
];

/** First-person/business verbs that explicitly offer the work. */
const OFFER_VERBS = [
  "میکنیم",
  "می کنیم",
  "انجام میدهیم",
  "انجام میدهد",
  "انجام می دهد",
  "میپذیریم",
  "می پذیریم",
  "در خدمتم",
  "در خدمتیم",
];

function hasNeedsRepairMark(normalized: string): string | null {
  for (const re of NEEDS_REPAIR_RES) {
    const at = normalized.search(re);
    if (at < 0) continue;
    // «بدون نیاز به تعمیر» states good condition, not damage.
    if (!normalized.slice(Math.max(0, at - 20), at).includes("بدون")) {
      return re.source;
    }
  }
  return null;
}

function hasServiceOfferMark(normalized: string): string | null {
  if (includesWord(normalized, "تعمیرکار")) return "تعمیرکار";
  // «خدمات» alone is ambiguous (after-sales feature vs offer), but adjacent
  // to «تعمیر» it names the offered work («خدمات تعمیر یخچال»).
  const tokens = normalized.split(" ").filter(Boolean);
  const serviceIdx: number[] = [];
  const repairIdx: number[] = [];
  tokens.forEach((tok, i) => {
    if (tok === "خدمات") serviceIdx.push(i);
    if (tok === "تعمیر" || tok === "تعمیرات") repairIdx.push(i);
  });
  if (serviceIdx.some((s) => repairIdx.some((r) => Math.abs(s - r) <= 4))) {
    return "خدمات+تعمیر";
  }
  const verb = OFFER_VERBS.find((p) => normalized.includes(p));
  if (verb && normalized.includes("تعمیر")) return `offer-verb:"${verb}"`;
  return null;
}

export function assessRepairService(text: string): {
  readonly signal: RepairServiceSignal;
  readonly reason: string;
} {
  const norm = normalizeForMatch(text);
  if (norm === "") return { signal: "unknown_or_mixed", reason: "empty-text" };
  const offer = hasServiceOfferMark(norm);
  const need = hasNeedsRepairMark(norm);
  if (offer && !need) return { signal: "service_offered", reason: `offer:${offer}` };
  if (need && !offer) return { signal: "item_needs_repair", reason: `needs:${need}` };
  return { signal: "unknown_or_mixed", reason: offer ? "offer+needs-mixed" : "no-signal" };
}

/**
 * Service-target binding (Phase 1.4): does the listing offer the service
 * for the REQUESTED appliance, or does the appliance merely appear?
 *
 * A global service verdict is not evidence that every product name in the
 * text is serviced. Binding requires an offer cue and a query-target term
 * in the SAME clause (split on ، . ! ؟) within ±4 tokens — e.g. «تعمیر
 * یخچال در محل» binds, while an offer clause plus a far-away incidental
 * «…، یخچال هم موجود است» does not. Polarity spans are stripped first, so
 * «بدون تعمیر» can never bind. Target terms expand through the same
 * category-aware aliases as matching («گوشی» counts for a «موبایل»
 * query). Queries with no target terms (bare «تعمیر») bind vacuously —
 * the target is unspecified, so nothing new is restricted.
 */
const SERVICE_GENERIC_WORDS = new Set([
  "تعمیر",
  "تعمیرات",
  "تعمیرکار",
  "تعمیرگاه",
  "خدمات",
  "سرویس",
  "سرویسکار",
  "نصب",
  "راه",
  "اندازی",
  "عیب",
  "یابی",
  "تخصصی",
  "متخصص",
  "نمایندگی",
  "مجاز",
]);

/** Single tokens that can anchor an offer (normalized). */
const BIND_CUE_TOKENS: readonly string[] = [
  "تعمیر",
  "تعمیرات",
  "تعمیرکار",
  "تعمیرگاه",
  "سرویسکار",
  "سیار",
  "منزل",
  "انواع",
  "تضمینی",
  "فوری",
  "سرویس",
  "نصب",
  "میپذیریم",
  "خدمتم",
  "خدمتیم",
];

/** Multi-token offer cues, as normalized token sequences. */
const BIND_CUE_PHRASES: readonly (readonly string[])[] = [
  ["در", "محل"],
  ["محل", "شما"],
  ["شبانه", "روزی"],
  ["عیب", "یابی"],
  ["راه", "اندازی"],
  ["انجام", "میدهیم"],
  ["انجام", "میدهد"],
  ["انجام", "می", "دهد"],
  ["در", "خدمتم"],
  ["در", "خدمتیم"],
  ["می", "پذیریم"],
];

const TARGET_WINDOW = 4;

export function assessServiceTarget(
  includeTerms: readonly string[],
  listingText: string,
  category?: string
): { readonly bound: boolean; readonly reason: string } {
  const targets = includeTerms
    .flatMap((t) => expandSynonyms(t, category))
    .flatMap((s) => normalizeForMatch(s).split(" ").filter(Boolean))
    .filter((tok) => !SERVICE_GENERIC_WORDS.has(tok));
  if (targets.length === 0) return { bound: true, reason: "no-target-terms" };
  // Expanded synonym keys are STEMMED (synonymKey stems), so listing tokens
  // are stemmed too before comparison — otherwise «گوشی» never equals the
  // «گوش» key. Cue constants are stemmed identically for the same reason.
  // Expanded synonym keys are ALREADY stemmed (synonymKey stems), so they
  // must NOT be stemmed again — stemming is not idempotent for ی-final
  // words («لباسشوی» would degrade to «لباسشو»). Only listing tokens and
  // surface cue constants pass through stemToken, exactly once each.
  const targetSet = new Set(targets);
  const cueTokenSet = new Set(BIND_CUE_TOKENS.map(stemToken));
  const cuePhrases = BIND_CUE_PHRASES.map((p) => p.map(stemToken));
  // Clause-local matching: split BEFORE normalization (normalization turns
  // clause punctuation into spaces, after which clauses are unrecoverable).
  const segments = listingText.split(/[،.!؟?!\n]+/);
  for (const seg of segments) {
    const tokens = stripRepairPolaritySpans(normalizeForMatch(seg))
      .split(" ")
      .filter(Boolean)
      .map(stemToken);
    if (tokens.length === 0) continue;
    const cueAt = new Set<number>();
    tokens.forEach((tok, i) => {
      if (cueTokenSet.has(tok)) cueAt.add(i);
    });
    for (const phrase of cuePhrases) {
      for (let i = 0; i + phrase.length <= tokens.length; i++) {
        if (phrase.every((w, k) => tokens[i + k] === w)) cueAt.add(i);
      }
    }
    if (cueAt.size === 0) continue;
    const bound = tokens.some(
      (tok, i) => targetSet.has(tok) && [...cueAt].some((c) => Math.abs(c - i) <= TARGET_WINDOW)
    );
    if (bound) return { bound: true, reason: "offer-target-proximity" };
  }
  return { bound: false, reason: "no-offer-target-proximity" };
}

/**
 * Sibling-variant markers: tokens that extend a model phrase into a more
 * specific SKU («پرو مکس» vs «پرو»). Bounded by design — a marker only
 * matters when every query term already matches AND the marker sits next
 * to a matched query term (longest-phrase locality, ±3 tokens).
 */
const VARIANT_MARKERS = ["مکس", "اولترا", "الترا", "پلاس", "مینی", "لایت", "اف ای"];

/**
 * Accessory markers: the listing is for an ACCESSORY of the hunted item,
 * not the item itself («قاب ایفون ۱۳ پرو» for an «آیفون ۱۳ پرو» hunt).
 * Same locality rule as variants: only matters when every query term
 * already matches AND the marker sits next to a matched query term.
 * Deliberately tight — «بند» (strap) etc. wait for R3 evidence.
 * A query that itself hunts the accessory («قاب ایفون») is unaffected:
 * the marker is skipped when it's one of the query tokens.
 */
const ACCESSORY_MARKERS = ["قاب", "کاور", "گلس"];

/**
 * Asymmetric model-identity check.
 *
 * - Specific query («آیفون ۱۳ پرو») vs more specific sibling listing
 *   («… پرو مکس»): MISMATCH — every query token matches, but the listing
 *   adds variant specificity the hunter did not ask for. Cap at near/related.
 * - Broad query («آیفون ۱۳») vs specific listing («… پرو»): NO mismatch —
 *   family-compatible, stays eligible under the existing contract.
 * - Exact phrase on both sides: no marker beyond the query → no mismatch.
 * - Accessory listing («قاب ایفون ۱۳ پرو») vs item query («آیفون ۱۳ پرو»):
 *   MISMATCH — the listing is for an accessory of the item, not the item.
 *   A query hunting the accessory itself («قاب ایفون») is unaffected.
 */
export function assessModelSpecificity(
  includeTerms: readonly string[],
  listingText: string,
  category?: string
): { readonly mismatch: boolean; readonly reason: string } {
  if (includeTerms.length === 0) return { mismatch: false, reason: "no-must-terms" };
  const listingNorm = normalizeForMatch(listingText);
  if (listingNorm === "") return { mismatch: false, reason: "empty-text" };

  // Identity reasoning starts only from full lexical evidence; partial
  // matches already resolve to near via MUST-missing.
  const allEvidenced = includeTerms.every((t) => textMatches(listingText, t, category));
  if (!allEvidenced) return { mismatch: false, reason: "partial-evidence" };

  const listingTokens = listingNorm.split(" ").filter(Boolean);
  const queryTokens = new Set(
    includeTerms.flatMap((t) => normalizeForMatch(t).split(" ").filter(Boolean))
  );
  const matchedPositions = new Set<number>();
  listingTokens.forEach((tok, i) => {
    if (queryTokens.has(tok)) matchedPositions.add(i);
  });

  for (const [markers, kind] of [
    [VARIANT_MARKERS, "sibling-variant"],
    [ACCESSORY_MARKERS, "accessory"],
  ] as const) {
    for (const rawMarker of markers) {
      const marker = normalizeForMatch(rawMarker);
      if (marker === "" || queryTokens.has(marker)) continue;
      const positions: number[] = [];
      listingTokens.forEach((tok, i) => {
        if (tok === marker) positions.push(i);
      });
      if (positions.length === 0) continue;
      const adjacent = positions.some((p) =>
        [...matchedPositions].some((m) => Math.abs(m - p) <= 3)
      );
      if (adjacent) {
        return {
          mismatch: true,
          reason: `${kind}:listing-adds:"${rawMarker}"`,
        };
      }
    }
  }
  return { mismatch: false, reason: "no-extra-variant" };
}
