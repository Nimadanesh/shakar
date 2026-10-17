import "server-only";

import {
  expandSynonyms,
  normalizeForMatch,
  stemToken,
  textMatches,
} from "@/lib/persianNormalize";
import { includesWord, isServiceDemandTerm, SERVICE_DEMAND_FAMILY } from "@/lib/interpret";

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

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Absence-polarity of a listing text for ANY attribute word — the
 * generalization of the repair-polarity machinery (R3, 2026-10-17).
 *
 * «بدون X» in Persian marketplace language names a desired ABSENCE
 * («ماشین بدون رنگ» wants unpainted cars), never a search ban — the old
 * code routed it through EXCLUDE_PREFIXES and murdered exactly the ads
 * the hunter wanted (R3 hunt 7: 9×0). Now بدون-attributes flow through
 * here: explicitly ABSENT («بدون رنگ») satisfies, explicitly PRESENT
 * («رنگ شده») contradicts, UNKNOWN caps to near — never exact, never
 * dropped.
 *
 * assessRepairPolarity is kept as a thin wrapper: same regexes for
 * word="تعمیر", so the battle-tested repair behavior is unchanged.
 */
/**
 * Absent-attribute synonyms (R4, 2026-10-17): sellers don't write the
 * buyer's words. «ماشین بدون تصادف» fails because ads say «بدون رنگ» /
 * «بی رنگ» / «بدون ضربه» — in vehicle ads the intent is the same (no
 * accident history ⇒ original paint). One-way bridge: «بدون رنگ» satisfies
 * «بدون تصادف», never the reverse beyond this mapping.
 */
const ABSENT_SYNONYMS: Record<string, readonly string[]> = {
  "تصادف": ["رنگ", "ضربه"],
};

/**
 * R7 (2026-10-18): defeasible absence — clause-level attribute claims with
 * counter-evidence (DeepSeek P2, adopted). The old per-word single polarity
 * found positive absence-evidence but never weighed counter-evidence: in
 * «دو تیکه رنگ و باقیش بی رنگ» the absent span for «رنگ» swallowed «دو
 * تیکه رنگ» (the filler let «بدون ضربه دور رنگ» match as one absent span
 * for «رنگ») — a false exact (R6 h7/h12).
 *
 * Model: per attribute word (plus its synonym bridge), find absent spans;
 * everything OUTSIDE those spans is counter-evidence territory. A
 * present-direct assertion («رنگ شده»، «دو تیکه رنگ»، «تصادف کرده»)
 * defeats the universal negative → "present" (rejected). A
 * present-implied assertion («دور رنگ»، «صافکاری»، «نقاشی» — evidence the
 * positive holds, tiered below direct) defeats exactness → "implied"
 * (capped to near, never exact). Otherwise an absent span satisfies →
 * "absent"; nothing at all → "unknown".
 *
 * The absent span owns its words (an old invariant, kept): a present
 * marker inside the SAME span is the absence claim itself («بدون رنگ»),
 * not counter-evidence. Implied words governed by بدون/بی («بدون نیاز
 * به صافکاری») are stripped before the implied check — negated bodywork
 * is not bodywork.
 */
export type AbsencePolarity = "absent" | "present" | "implied" | "unknown";

/** Attribute families for present-implied evidence (closed classes). */
const ABSENCE_FAMILY: Record<string, "paint" | "scratch"> = {
  "رنگ": "paint",
  "تصادف": "paint",
  "ضربه": "paint",
  "خط": "scratch",
  "خش": "scratch",
};
const IMPLIED_PATTERNS: Record<"paint" | "scratch", RegExp[]> = {
  // «دور رنگ» = full repaint; «صافکاری»/«نقاشی» = bodywork happened.
  paint: [/دور\s*رنگ/, /صافکاری/, /نقاشی/],
  scratch: [],
};
/** Negation-governed implied words («بدون نیاز به صافکاری» ≠ bodywork). */
const IMPLIED_TOKENS = new Set(["صافکاری", "نقاشی"]);
const NEGATION_TOKENS = new Set(["بدون", "بی"]);

/**
 * Drop بدون/بی-governed implied words at the token level (no regex):
 * «بدون نیاز به صافکاری» must not read as counter-evidence.
 * «دور رنگ» is a two-token phrase (دور + رنگ).
 */
function stripNegatedImplied(clause: string): string {
  const toks = clause.split(" ").filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    if (NEGATION_TOKENS.has(toks[i])) {
      let drop = 0;
      for (let k = 1; k <= 3 && i + k < toks.length; k++) {
        const t = toks[i + k];
        if (IMPLIED_TOKENS.has(t)) {
          drop = k + 1;
          break;
        }
        if (t === "دور" && toks[i + k + 1] === "رنگ") {
          drop = k + 2;
          break;
        }
      }
      if (drop > 0) {
        i += drop;
        continue;
      }
    }
    out.push(toks[i]);
    i++;
  }
  return out.join(" ");
}

function assessAbsenceOneWord(
  text: string,
  word: string
): {
  readonly polarity: AbsencePolarity;
  readonly reason: string;
} {
  const norm = normalizeForMatch(text);
  if (norm === "") return { polarity: "unknown", reason: "empty-text" };
  const w = escRe(normalizeForMatch(word));
  if (w === "") return { polarity: "unknown", reason: "empty-word" };
  // Filler guard (kept from the original): any word EXCEPT the attribute
  // itself and polarity words. «بدون رنگ ولی رنگ شده» must not match as
  // one absent span.
  const filler = String.raw`((?:\s+(?!${w}|بدون|نشده|شده)\S+)){0,2}`;
  const absentRes: readonly RegExp[] = [
    new RegExp(`بدون${filler}\\s+${w}(ات|ی)?`),
    new RegExp(`بی\\s*${w}`),
    new RegExp(`${w}(ات)?\\s+نشده`),
    new RegExp(`${w}نشده`),
    new RegExp(`${w}\\s+نکرده`),
  ];
  const directRes: readonly RegExp[] = [
    new RegExp(`(\\d+|[۰-۹]+|یک|یه|دو|سه|چهار|پنج|چند)\\s*(تیکه|تکه)\\s+${w}`),
    new RegExp(`${w}(ات)?${filler}\\s+شده`),
    new RegExp(`${w}شده`),
    new RegExp(`${w}\\s+کرده`),
  ];
  // 1. Absent spans own their words — cut them out first so counter-
  // evidence is only ever read OUTSIDE the absence claim itself.
  let remainder = ` ${norm} `;
  let absentHit: string | null = null;
  for (const re of absentRes) {
    const g = new RegExp(re.source, "g");
    remainder = remainder.replace(g, () => {
      if (absentHit === null) absentHit = re.source;
      return " ";
    });
  }
  remainder = remainder.replace(/\s+/g, " ").trim();
  // 2. Present-direct OUTSIDE the absent spans defeats the universal
  // negative — one positive existential wins (logic, not vocabulary).
  const directHit = directRes.find((re) => re.test(remainder))?.source ?? null;
  if (directHit) {
    return { polarity: "present", reason: `absence-defeated:${directHit}` };
  }
  // 3. Present-implied (tiered below direct): negated bodywork stripped.
  const family = ABSENCE_FAMILY[normalizeForMatch(word)];
  const unnegated = stripNegatedImplied(remainder);
  const impliedHit =
    (family ? IMPLIED_PATTERNS[family] : []).find((re) => re.test(unnegated))
      ?.source ?? null;
  if (impliedHit) {
    return { polarity: "implied", reason: `absence-implied:${impliedHit}` };
  }
  // 4. An absent span with no counter-evidence satisfies.
  if (absentHit) {
    return { polarity: "absent", reason: `absence-absent:${absentHit}` };
  }
  return { polarity: "unknown", reason: "no-absence-polarity-mark" };
}

/**
 * Absence polarity with the synonym bridge (kept from R4): «بی رنگ» ⇒
 * «بدون تصادف». Strength order across the word and its synonyms:
 * present > implied > absent > unknown — a single positive anywhere
 * defeats the claim.
 */
export function assessAbsencePolarity(
  text: string,
  word: string
): {
  readonly polarity: AbsencePolarity;
  readonly reason: string;
} {
  const synonyms = ABSENT_SYNONYMS[normalizeForMatch(word)] ?? [];
  let best: { readonly polarity: AbsencePolarity; readonly reason: string } = {
    polarity: "unknown",
    reason: "no-absence-polarity-mark",
  };
  const rank = (p: AbsencePolarity): number =>
    p === "present" ? 3 : p === "implied" ? 2 : p === "absent" ? 1 : 0;
  for (const w of [word, ...synonyms]) {
    const r = assessAbsenceOneWord(text, w);
    if (rank(r.polarity) > rank(best.polarity)) best = r;
    if (best.polarity === "present") break;
  }
  if (best.polarity === "absent" && best.reason.startsWith("absence-absent:")) {
    // Disclose the synonym bridge (kept from R4) — «چرا این آگهی؟» shows
    // the real evidence, never a silent claim.
    const viaWord = [word, ...synonyms].find(
      (w) => assessAbsenceOneWord(text, w).polarity === "absent"
    );
    if (viaWord && normalizeForMatch(viaWord) !== normalizeForMatch(word)) {
      return {
        polarity: "absent",
        reason: `absence-absent-via-synonym:${viaWord}`,
      };
    }
  }
  return best;
}

/**
 * The original repair pattern sets, kept for stripRepairPolaritySpans
 * (service-offer assessment must not read «بدون تعمیر» as a service cue).
 * Rebuilt from the generalized polarity patterns for word="تعمیر" so the
 * two can never drift apart.
 */
function repairPatterns(): readonly RegExp[] {
  const w = "تعمیر";
  const filler = String.raw`((?:\s+(?!${w}|بدون|نشده|شده)\S+)){0,2}`;
  return [
    new RegExp(`بدون${filler}\\s+${w}(ات|ی)?`),
    new RegExp(`بی\\s*${w}`),
    new RegExp(`${w}(ات)?\\s+نشده`),
    new RegExp(`${w}نشده`),
    new RegExp(`${w}\\s+نکرده`),
    new RegExp(`${w}(ات)?${filler}\\s+شده`),
    new RegExp(`${w}شده`),
    new RegExp(`${w}ی`),
    new RegExp(`نیاز\\s+به\\s+${w}`),
  ];
}

/**
 * Assess repair-history polarity — thin wrapper over the generalized
 * absence polarity (R3, 2026-10-17). Conflicting marks resolve to unknown.
 */
export function assessRepairPolarity(text: string): {
  readonly polarity: RepairPolarity;
  readonly reason: string;
} {
  const r = assessAbsencePolarity(text, "تعمیر");
  // "implied" has no repair-word meaning (no implied family for تعمیر) —
  // fold it to unknown, the conservative existing behavior.
  const polarity: RepairPolarity =
    r.polarity === "implied" ? "unknown" : r.polarity;
  return { polarity, reason: r.reason };
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
  for (const re of repairPatterns()) {
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
 * R3 (2026-10-17): «وانت» joins — «وانت پراید» is a marginal variant of a
 * «پراید» hunt (graded 1, not exact), while a «وانت پراید» hunt itself is
 * unaffected (marker ∈ query tokens → skipped).
 */
const VARIANT_MARKERS = ["مکس", "اولترا", "الترا", "پلاس", "مینی", "لایت", "اف ای", "وانت"];

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
 * R3 (2026-10-17) — listing-subject markers. The ad's SUBJECT (what is
 * actually offered, usually the first content token) tells whether the
 * listing is the item or something orbiting it:
 * - PART_MARKERS: vehicle/device parts («باطری ماشین» is not a car,
 *   «رینگ پراید» is not a Pride);
 * - PACKAGING_MARKERS: the box, not the item («کارتون ماشین لباسشویی»);
 * - EQUIPMENT_MARKERS: the machine/tool, not the item («دستگاه کره
 *   بادوم زمینی» is not peanuts);
 * - DERIVED_MARKERS: processed forms («کره بادوم زمینی» is not peanuts —
 *   subject-first only, so «بادوم زمینی مخصوص کره گیری» stays exact).
 * Every entry earned by an R3 zero-grade. Same guard as accessories: a
 * query hunting the marker itself is unaffected.
 */
const PART_MARKERS = [
  "رینگ",
  "لاستیک",
  "تایر",
  "قالپاق",
  "باطری",
  "باتری",
  "چراغ",
  "روکش",
  "باند",
  "دزدگیر",
  "ردیاب",
  "ضبط",
  "چادر",
  // R4 (2026-10-17) — mined from full result sets, every entry earned by a
  // zero-grade or an exact-labeled parts ad: «دیسک و صحفه کلاچ پراید»,
  // «فنر عقب پراید», «درب پراید», «استپر موتور پراید», «رادیات/رادیاتور»,
  // «نمد», «مه» (= مه‌شکن), «برد ایفون» (motherboard), «باربند/کابین/اتاق
  // پراید وانت», «حواله پراید وانت» (transfer slip), «شلنگ ماشین
  // لباسشویی», «یراق/پارچه مبل», «گارد ایفون» (case — subject rule, not
  // adjacency, so «ایفون با گارد رایگان» stays clean).
  "گیربکس",
  "دیسک",
  "صفحه",
  "صحفه", // wild misspelling of صفحه («دیسک و صحفه کلاچ»)
  "کلاچ",
  "فنر",
  "درب",
  "استپر",
  "رادیاتور",
  "رادیات", // truncated surface form in the wild
  "نمد",
  "مه", // مه‌شکن — token-exact only, never substring
  "برد",
  "باربند",
  "کابین",
  "اتاق", // truck body («اتاق پراید وانت»); a «اتاق خواب» hunt skips it (guard)
  "حواله", // purchase slip, not the item («حواله پراید وانت»)
  "شلنگ",
  "یراق",
  "پارچه",
  "گارد",
  // R6 (2026-10-17) — mined from R5 zero-grades: «اوراقی خودرو پیکان و
  // پراید» (junkyard — sibling of اسقاط), «ست کامل جلوبندی پراید»
  // (suspension), «۱۳۲کفپوش‌پراید» (floor mat, digit-glued in stuffing),
  // «لپازم موتور سیکلت» (لوازم typo — accessories). «لوازم» itself stays
  // OUT: too broad («لوازم خانگی» can be the item).
  "اوراقی",
  "جلوبندی",
  "کفپوش",
  "لپازم",
];
const PACKAGING_MARKERS = ["کارتون", "کارتن", "جعبه"];
const EQUIPMENT_MARKERS = ["دستگاه", "تجهیزات", "یخچال"]; // R4: «یخچال پراید وانت مخصوص حمل بستنی»
const DERIVED_MARKERS = ["کره", "خلال", "کرم"]; // R6: «کرم» = کره typo in the wild («کرم بادوم زمینی پروتئینی»)
/**
 * R6 (2026-10-17) — seeker-role words: the ad is a WANTED ad, not an
 * offering («جویای آموزش تعمیرات موبایل», «مشتری یخچال فریزر»). Mirror of
 * the S4 dealer logic, opposite direction. First-phrase-position only:
 * «فروشنده مشتری‌مدار یخچال» (ZWNJ splits مشتری‌مدار) must stay clean.
 */
const SEEKER_MARKERS = ["جویای", "مشتری"];
/**
 * R4 (2026-10-17) — consumables: the supply, not the machine («پودر ماشین
 * لباسشویی» is not a washer). Subject-aware like parts.
 */
const CONSUMABLE_MARKERS = ["پودر", "مایع", "قرص", "شوینده"];
/**
 * R4 (2026-10-17) — training courses: the course, not the service («آموزش
 * تخصصی تعمیرات موبایل» ×14 exact-labeled for a «تعمیرات تخصصی موبایل»
 * service hunt). Subject-aware: «تعمیرات موبایل با آموزش رایگان» (clean
 * subject) is unaffected. A hunt for «آموزش …» skips via the query guard.
 */
const TRAINING_MARKERS = ["آموزش", "آموزشگاه", "دوره", "کلاس"];

/**
 * Leading sale-cue tokens skipped when locating the ad's subject: «فروش
 * قاب ایفون» is about the قاب, but «فروش پراید با رینگ اسپرت» is about
 * the پراید. Without the skip, the sale cue would shield accessory
 * listings; without the clean-subject rule, feature mentions («با رینگ
 * اسپرت») would demote genuine cars.
 */
const SUBJECT_SKIP_TOKENS = new Set([
  "فروش",
  "فروشی",
  "میفروشم",
  "می",
  "فروشم",
  // R6 (2026-10-17): bundle/sale-shape words that shielded کره —
  // «فروش عمده کره بادوم زمینی», «تولیدی کره بادوم زمینی».
  "عمده",
  "تولیدی",
  "پخش",
]);

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
 * - R3 subject rule: the listing's SUBJECT (first content token, skipping
 *   sale cues) decides. A clean subject (the item itself — «پراید ۱۳۱ با
 *   رینگ اسپرت») means accessory words are just features → no mismatch.
 *   A marker subject («باطری ماشین», «کارتون …», «کره بادوم زمینی») or a
 *   marker adjacent to a matched term under a non-clean subject («اقساط
 *   روکش صندلی … باند ماشین») → mismatch.
 */
/**
 * Strip digit runs glued to a token's edges («۱۳۲کفپوش» → «کفپوش»).
 * Keyword stuffing glues model numbers to part names; general substring
 * matching stays banned (R4 «مه» lesson).
 */
function stripEdgeDigits(tok: string): string {
  return tok.replace(/^[\d۰-۹]+/u, "").replace(/[\d۰-۹]+$/u, "");
}

export function assessModelSpecificity(
  includeTerms: readonly string[],
  listingText: string,
  category?: string
): { readonly mismatch: boolean; readonly reason: string; readonly tier: "reject" | "near" } {
  if (includeTerms.length === 0) return { mismatch: false, reason: "no-must-terms", tier: "near" };
  const listingNorm = normalizeForMatch(listingText);
  if (listingNorm === "") return { mismatch: false, reason: "empty-text", tier: "near" };

  // Identity reasoning starts only from full lexical evidence; partial
  // matches already resolve to near via MUST-missing.
  const allEvidenced = includeTerms.every((t) => textMatches(listingText, t, category));
  if (!allEvidenced) return { mismatch: false, reason: "partial-evidence", tier: "near" };

  const listingTokens = listingNorm.split(" ").filter(Boolean);
  const queryTokens = new Set(
    includeTerms.flatMap((t) => normalizeForMatch(t).split(" ").filter(Boolean))
  );
  const matchedPositions = new Set<number>();
  listingTokens.forEach((tok, i) => {
    if (queryTokens.has(tok)) matchedPositions.add(i);
  });

  // The ad's subject: first content token after sale cues. A clean subject
  // (the hunted item itself) means marker words elsewhere are features,
  // not the offering — «پراید ۱۳۱ با رینگ اسپرت» is a car.
  let subjectIdx = 0;
  while (
    subjectIdx < listingTokens.length &&
    SUBJECT_SKIP_TOKENS.has(listingTokens[subjectIdx])
  ) {
    subjectIdx += 1;
  }

  // R6 (2026-10-17) — the subject PHRASE: everything the ad names BEFORE
  // the hunted item. «ست کامل جلوبندی پراید» sells جلوبندی; «اقساطی
  // پراید با روکش صندلی» sells a car (روکش is a با-feature). A wrong-item
  // marker inside the subject phrase means the ad IS the wrong item —
  // tier "reject" (navid's R5 product decision: 0 = wrong item, not shown).
  // Markers after the item stay on the old weak path (tier "near").
  // Needs a token-exact item anchor; fuzzy-only evidence falls back to
  // the old path (conservative).
  const firstQueryIdx = listingTokens.findIndex((t) => queryTokens.has(t));
  const subjectPhrase: string[] = [];
  const phraseIdx: number[] = [];
  if (firstQueryIdx >= 0) {
    for (let i = subjectIdx; i < firstQueryIdx; i++) {
      subjectPhrase.push(listingTokens[i]);
      phraseIdx.push(i);
    }
  }
  // «مخصوص X گیری» purpose-phrase protection (R4 ingredient rule): the
  // derived word inside it names the purpose, not the offering.
  const purposeProtected = new Set<number>();
  listingTokens.forEach((_tok, i) => {
    if (
      listingTokens[i] === "مخصوص" &&
      listingTokens[i + 2] === "گیری" &&
      DERIVED_MARKERS.some((d) => normalizeForMatch(d) === listingTokens[i + 1])
    ) {
      purposeProtected.add(i);
      purposeProtected.add(i + 1);
      purposeProtected.add(i + 2);
    }
  });
  const phraseHas = (marker: string): boolean =>
    phraseIdx.some((gi) => {
      if (purposeProtected.has(gi)) return false;
      const tok = listingTokens[gi];
      return (
        tok === marker ||
        (stripEdgeDigits(tok) !== tok && stripEdgeDigits(tok) === marker)
      );
    });

  const markerSets: ReadonlyArray<{
    readonly markers: readonly string[];
    readonly kind: string;
    /** Subject-aware sets (R3 parts/packaging/equipment): a clean subject
     *  (the item itself) means the marker is a feature, not the offering.
     *  Variant/accessory sets keep the battle-tested adjacency rule. */
    readonly subjectAware?: boolean;
    readonly subjectFirstOnly?: boolean;
  }> = [
    { markers: VARIANT_MARKERS, kind: "sibling-variant" },
    { markers: ACCESSORY_MARKERS, kind: "accessory" },
    { markers: PART_MARKERS, kind: "part", subjectAware: true },
    { markers: PACKAGING_MARKERS, kind: "packaging", subjectAware: true },
    { markers: EQUIPMENT_MARKERS, kind: "equipment", subjectAware: true },
    { markers: CONSUMABLE_MARKERS, kind: "consumable", subjectAware: true },
    { markers: TRAINING_MARKERS, kind: "training", subjectAware: true },
    // Derived forms only demote when they LEAD («کره بادوم زمینی»).
    {
      markers: DERIVED_MARKERS,
      kind: "derived-product",
      subjectAware: true,
      subjectFirstOnly: true,
    },
  ];
  // R4 (2026-10-17) — the ingredient rule: «X مخصوص کره گیری» is X (the
  // ingredient), not the derived product. When the query hunts the derived
  // product («کره بادوم زمینی») this listing is a near-miss, not exact —
  // navid graded it 0. For a «بادوم زمینی» hunt the کره guard above skips
  // (کره ∉ query tokens) and the listing correctly stays exact (graded 3).
  for (const rawDerived of DERIVED_MARKERS) {
    const derived = normalizeForMatch(rawDerived);
    if (derived === "" || !queryTokens.has(derived)) continue;
    if (new RegExp(`مخصوص\\s+${escRe(derived)}\\s+گیری`).test(listingNorm)) {
      return {
        mismatch: true,
        reason: `derived-product:ingredient-for:"${rawDerived}"`,
        tier: "reject",
      };
    }
  }
  // R6 — wrong-item phrase pass (strong signal → reject). Runs before the
  // weak adjacency pass below. Sibling variants are EXCLUDED: «پرومکس
  // آیفون ۱۳» is still the item (near, not rejected — honest spectrum).
  for (const { markers, kind } of markerSets) {
    if (kind === "sibling-variant") continue;
    for (const rawMarker of markers) {
      const marker = normalizeForMatch(rawMarker);
      if (marker === "" || queryTokens.has(marker)) continue;
      if (phraseHas(marker)) {
        return {
          mismatch: true,
          reason: `${kind}:offering:"${rawMarker}"`,
          tier: "reject",
        };
      }
    }
  }
  // R6 — seeker roles: «جویای آموزش …», «مشتری یخچال …» are WANTED ads.
  // First-phrase-position only: «فروشنده مشتری‌مدار یخچال» (ZWNJ splits
  // مشتری‌مدار — verified by tokenization probe) must stay clean.
  for (const rawSeeker of SEEKER_MARKERS) {
    const seeker = normalizeForMatch(rawSeeker);
    if (seeker === "" || queryTokens.has(seeker)) continue;
    if (subjectPhrase[0] === seeker) {
      return {
        mismatch: true,
        reason: `seeker:offering:"${rawSeeker}"`,
        tier: "reject",
      };
    }
  }
  // R6 — mixed-role dealer: «فروشنده خریدار یخچال» is a business card,
  // not a listing. Pure-role dealers stay on the S4 scoring path.
  if (
    subjectPhrase.includes(normalizeForMatch("فروشنده")) &&
    subjectPhrase.includes(normalizeForMatch("خریدار"))
  ) {
    return {
      mismatch: true,
      reason: `dealer-mixed:offering:"فروشنده خریدار"`,
      tier: "reject",
    };
  }
  const subjectClean = queryTokens.has(listingTokens[subjectIdx] ?? "");
  for (const { markers, kind, subjectAware, subjectFirstOnly } of markerSets) {
    for (const rawMarker of markers) {
      const marker = normalizeForMatch(rawMarker);
      if (marker === "" || queryTokens.has(marker)) continue;
      const positions: number[] = [];
      listingTokens.forEach((tok, i) => {
        if (tok === marker) positions.push(i);
      });
      if (positions.length === 0) continue;
      if (positions.includes(subjectIdx)) {
        return {
          mismatch: true,
          reason: `${kind}:subject:"${rawMarker}"`,
          tier: "near",
        };
      }
      if (subjectFirstOnly) continue;
      // A clean subject means the marker is a feature of the item
      // («پراید ۱۳۱ با رینگ اسپرت» is a car, not a rim) — but only for
      // the subject-aware sets; variant/accessory keep the old rule.
      if (subjectAware && subjectClean) continue;
      const adjacent = positions.some((p) =>
        [...matchedPositions].some((m) => Math.abs(m - p) <= 3)
      );
      if (adjacent) {
        return {
          mismatch: true,
          reason: `${kind}:listing-adds:"${rawMarker}"`,
          tier: "near",
        };
      }
    }
  }
  return { mismatch: false, reason: "no-extra-variant", tier: "near" };
}

/**
 * Equipment-before-service (R3, 2026-10-17): on a service-intent hunt, a
 * listing whose EQUIPMENT word precedes any service word sells equipment,
 * it doesn't offer the service («فروش فوری تجهیزات تخصصی تعمیرات موبایل»
 * vs «تعمیرگاه مجهز با تجهیزات پیشرفته» — the latter leads with the
 * service and is unaffected).
 */
const SERVICE_SUBJECT_VOCAB: ReadonlySet<string> = new Set(
  ["تعمیر", "تعمیرات", "تعمیرکار", "تعمیرگاه", "نصب", "نصاب", "سرویس", "سرویسکار"].map(
    (w) => normalizeForMatch(w)
  )
);

export function equipmentBeforeService(text: string): boolean {
  const tokens = normalizeForMatch(text).split(" ").filter(Boolean);
  const equipIdx = tokens.findIndex((t) => EQUIPMENT_MARKERS.includes(t));
  if (equipIdx < 0) return false;
  const serviceIdx = tokens.findIndex((t) => SERVICE_SUBJECT_VOCAB.has(t));
  return serviceIdx < 0 || equipIdx < serviceIdx;
}

/**
 * R6 (2026-10-17) — demand-hunt vs goods-ad: on a service-DEMAND hunt
 * («نصاب کولر گازی می‌خوام»), an ad whose leading phrase names the
 * PRODUCT («کولرگازی اصلی … (نصب امروز)») is a goods ad borrowing a
 * service word, not an installer. Fires only when the demand term is
 * satisfied SOLELY via the morphological family («نصب» for «نصاب») —
 * a literal service lead («نصب و تعمیر کولر گازی», «تعمیرکار مجاز …»)
 * stays clean. Callers must gate on def.serviceIntent.
 */
export function assessDemandGoods(
  includeTerms: readonly string[],
  listingText: string
): boolean {
  const demandTerms = includeTerms.filter((t) => isServiceDemandTerm(t));
  if (demandTerms.length === 0) return false;
  const familyOnly = demandTerms.some(
    (t) =>
      !textMatches(listingText, t) &&
      SERVICE_DEMAND_FAMILY.some((w) => textMatches(listingText, w))
  );
  if (!familyOnly) return false;
  const tokens = normalizeForMatch(listingText).split(" ").filter(Boolean);
  let si = 0;
  while (si < tokens.length && SUBJECT_SKIP_TOKENS.has(tokens[si])) si++;
  const lead = tokens.slice(si, si + 4);
  return !lead.some((t) => SERVICE_SUBJECT_VOCAB.has(t));
}

/**
 * R6 (2026-10-17) — bait titles: the title claims the full multi-token
 * item («موتور سیکلت») but the description is about a confusable product
 * («موتور برق ۳/۵کیلووات …» — never mentions سیکلت). Tight by design:
 * - multi-token MUST only (single-token items can't bait this way);
 * - the description must MISS a title-evidenced term (terse-but-honest
 *   descriptions like «تمیز، مدل ۱۴۰۳» don't fire);
 * - the description must lead with the same HEAD token + a different,
 *   non-variant modifier («موتور برق» vs «موتور سیکلت»; «پراید وانت»
 *   is a variant → sibling-variant near, not bait).
 */
export function assessBaitTitle(
  title: string,
  description: string,
  includeTerms: readonly string[]
): boolean {
  if (includeTerms.length < 2 || description.trim() === "") return false;
  const titleTerms = includeTerms.filter((t) => textMatches(title, t));
  if (titleTerms.length < includeTerms.length) return false;
  if (!includeTerms.some((t) => !textMatches(description, t))) return false;
  const normTerms = includeTerms.map(
    (t) => normalizeForMatch(t).split(" ").filter(Boolean)[0] ?? ""
  );
  const head = normTerms[0];
  const expectedMod = normTerms[1];
  if (head === "" || expectedMod === "") return false;
  // Bait = a BARE title claim: the title adds nothing beyond the query
  // («موتور سیکلت»). Titles with extra descriptors («قاب ایفون ۱۳ پرو»,
  // «تعمیرات تخصصی موبایل در محل») are normal ads with terse descs —
  // rejecting those would nuke honest listings.
  const queryTokSet = new Set(
    includeTerms.flatMap((t) => normalizeForMatch(t).split(" ").filter(Boolean))
  );
  const titleTokens = normalizeForMatch(title).split(" ").filter(Boolean);
  if (!titleTokens.every((t) => queryTokSet.has(t))) return false;
  const dTokens = normalizeForMatch(description).split(" ").filter(Boolean);
  const hi = dTokens.indexOf(head);
  if (hi < 0 || hi + 1 >= dTokens.length) return false;
  const mod = dTokens[hi + 1];
  if (mod === expectedMod) return false;
  if (VARIANT_MARKERS.some((v) => normalizeForMatch(v) === mod)) return false;
  return true;
}
