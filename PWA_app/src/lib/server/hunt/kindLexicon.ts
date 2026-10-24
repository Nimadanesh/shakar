/**
 * R7 (2026-10-18): subject-kind lexicon — the closed kind space for the
 * entity-centric gate (DeepSeek P1, adopted; musi's subject-first reframe).
 *
 * Mined from the R6 laptop corpus (2124 ad titles, 24 hunts) + manual
 * review; frozen as data. New wrong-kind families go HERE (one lexicon
 * entry), never as new marker lists — that is the anti-whack-a-mole law.
 *
 * Kinds are flat strings: "<domain>" (the item itself) or
 * "<domain>-<role>" (part, accessory, derived, consumable). The gate
 * compares kinds structurally; open lexical classes (part NAMES) are
 * never enumerated — only the closed kind labels are.
 *
 * Methodology law (DeepSeek): closed grammatical/ontological classes may
 * be enumerated; open lexical classes may not, ever.
 *
 * R8 contract (2026-10-19): HEAD_KIND now serves THREE readers — the kind
 * gate (kindGateRejects), the query-kind resolver (queryKindForDef), and
 * the marker guard (assessModelSpecificity's kind-aware skip). A new entry
 * must be true in ALL THREE senses: the word's kind as an ad head, as a
 * query subject, and as a co-offered sibling. When in doubt, don't add —
 * unknown no-ops everywhere (anti-overfilter law).
 */

import { normalizeForMatch, stemToken } from "@/lib/persianNormalize";

/** Head-NP → kind. Longest match wins («ماشین لباسشویی» beats «ماشین»). */
export const HEAD_KIND: Record<string, string> = {
  // Vehicles
  "پراید": "vehicle",
  "پژو": "vehicle",
  "سمند": "vehicle",
  "دنا": "vehicle",
  "تیبا": "vehicle",
  "وانت": "vehicle",
  "ماشین": "vehicle",
  "موتور سیکلت": "vehicle",
  "موتور": "vehicle",
  // Vehicle parts & accessories
  "باطری": "vehicle-part",
  "باتری": "vehicle-part",
  "باطری ماشین": "vehicle-part",
  "باتری ماشین": "vehicle-part",
  "دیسک": "vehicle-part",
  "لنت": "vehicle-part",
  "شمع": "vehicle-part",
  // Mobile
  "آیفون": "mobile",
  "ایفون": "mobile",
  "گوشی": "mobile",
  "موبایل": "mobile",
  "تبلت": "mobile",
  "قاب": "mobile-accessory",
  "کاور": "mobile-accessory",
  "گلس": "mobile-accessory",
  // R8 (F2): «گارد و قاب آیفون ۱۳» is a same-kind sibling, not a wrong
  // item. The R6 rule survives: query kind mobile ≠ mobile-accessory, so
  // «گارد آیفون ۱۳ پرو» on an «آیفون ۱۳ پرو» hunt still rejects.
  "گارد": "mobile-accessory",
  // Appliances & home
  "یخچال": "appliance",
  "یخچال فریزر": "appliance",
  "فریزر": "appliance",
  "ماشین لباسشویی": "appliance",
  "ماشین ظرفشویی": "appliance",
  "لباسشویی": "appliance",
  "کولر": "appliance",
  "تلویزیون": "appliance",
  "مبل": "furniture",
  "مبلمان": "furniture",
  "میز": "furniture",
  "تخت": "furniture",
  "کمد": "furniture",
  "صندلی": "furniture",
  "صندلی ماشین": "vehicle-part",
  "سرویس خواب": "furniture",
  "لوستر": "home-goods",
  "فرش": "home-goods",
  // Food
  "بادام": "food",
  "بادوم": "food",
  "پسته": "food",
  // Derived food products (symmetric with food — navid's بادوم rule)
  "کره": "food-derived",
  "کرم": "food-derived", // observed typo of کره in the wild (R5)
  "کره بادام": "food-derived",
  "ارده": "food-derived",
  "خلال": "food-derived",
  // Consumables
  "پودر": "consumable",
  "پودر لباسشویی": "consumable",
  "مایع": "consumable",
  "شوینده": "consumable",
  // Equipment (the machine, not the item)
  "دستگاه": "equipment",
  "تجهیزات": "equipment",
  // Services & training
  "تعمیرات": "service",
  "تعمیر": "service",
  "تعمیرکار": "service",
  "نصاب": "service",
  "نصب": "service",
  "سرویس": "service",
  "امداد": "service",
  // R8b (double-check F4a gap): «خدمات» is the most common service head
  // («خدمات باطری ماشین») — without it the ad kind is null and the F4a
  // demote never applies. 3-reader check: as ad head → service ✓; as
  // query subject → service hunt ✓; as marker guard → no marker named
  // خدمات, no-op ✓.
  "خدمات": "service",
  "آموزش": "training",
  "اموزش": "training", // observed spelling in the wild
  "آموزشگاه": "training",
  // R8 (F2): sibling markers need kinds for the kind-aware marker guard —
  // «دوره»/«کلاس» co-offered on a training hunt («دوره آموزش تعمیرات
  // موبایل») are the hunted item, not a wrong item.
  "دوره": "training",
  "کلاس": "training",
  // Real estate
  "آپارتمان": "realestate",
  "اپارتمان": "realestate", // observed spelling in the wild
  "ویل": "realestate",
  "زمین": "realestate",
  // Signage
  "تابلو": "signage",
};

/** Tokens skipped when finding an ad's head («فروش پراید» → head is پراید). */
export const HEAD_SKIP_TOKENS = new Set([
  "فروش",
  "فروشی",
  "فوری",
  "عمده",
  "انواع",
  "تکی",
]);

/**
 * Fixpoint stemmer — stemming is NOT idempotent («لباسشویی»→«لباسشوی»→
 * «لباسشو»), so a single stemToken pass can't bridge «لباسشوی» (ad) and
 * «لباسشویی» (lexicon key).
 */
function stemFix(tok: string): string {
  let t = tok;
  for (let i = 0; i < 3; i++) {
    const s = stemToken(t);
    if (s === t) return t;
    t = s;
  }
  return t;
}

/**
 * HEAD_KIND keyed by fixpoint-stemmed tokens — FALLBACK ONLY (R8 F4c).
 * Raw lookup always wins; this only rescues ی-dropped spellings
 * («ماشین لباسشوی» → «ماشین لباسشویی»). First raw key wins on collision.
 */
const HEAD_KIND_STEMMED: Map<string, string> = new Map();
for (const [key, kind] of Object.entries(HEAD_KIND)) {
  const sk = key.split(" ").map(stemFix).join(" ");
  if (!HEAD_KIND_STEMMED.has(sk)) HEAD_KIND_STEMMED.set(sk, kind);
}

/**
 * The ad's subject kind from its title: skip sale cues, then longest
 * head-NP match (2 tokens, then 1). Returns null when unknown — the gate
 * never fires on unknown (anti-overfilter law).
 *
 * R7-redteam P0: the title is normalized before lookup (ZWNJ → space), so
 * «ماشین‌لباسشویی» reads as «ماشین لباسشویی».
 */
export function adKindForTitle(title: string): string | null {
  const toks = normalizeForMatch(title)
    .split(" ")
    .filter(Boolean)
    .filter((t) => !HEAD_SKIP_TOKENS.has(t));
  if (toks.length === 0) return null;
  if (toks.length >= 2) {
    const two = `${toks[0]} ${toks[1]}`;
    if (HEAD_KIND[two] !== undefined) return HEAD_KIND[two];
    // R8 (F4c): stemmed fallback BEFORE the generic-head rule — the raw
    // lookup uses surface tokens while the pipeline stems («ماشین لباسشوی»
    // must still find «ماشین لباسشویی»).
    const twoStemmed = `${stemFix(toks[0])} ${stemFix(toks[1])}`;
    const stemmedKind = HEAD_KIND_STEMMED.get(twoStemmed);
    if (stemmedKind !== undefined) return stemmedKind;
    // R8 (F4b): generic heads (ماشین/موتور) with an unknown modifier are
    // UNKNOWN, not vehicle («ماشین جوجه کشی» is equipment, not a car).
    // «ماشین»/«موتور» alone still resolve to vehicle below.
    if (toks[0] === "ماشین" || toks[0] === "موتور") return null;
  }
  // R8c (double-check R8b R-E): bare «خدمات» is ambiguous — «خدمات پس از
  // فروش» is a goods-ad phrase (interpret.ts:269), not a service head.
  // Only claim service when خدمات actually heads something serviceable.
  if (toks[0] === "خدمات" && (toks.length < 2 || toks[1] === "پس")) return null;
  if (HEAD_KIND[toks[0]] !== undefined) return HEAD_KIND[toks[0]];
  // R8 (F4c): single-token stemmed fallback.
  const oneStemmed = HEAD_KIND_STEMMED.get(stemFix(toks[0]));
  if (oneStemmed !== undefined) return oneStemmed;
  return null;
}

function splitKind(kind: string): [string, string] {
  const i = kind.lastIndexOf("-");
  if (i <= 0) return [kind, "item"];
  return [kind.slice(0, i), kind.slice(i + 1)];
}

/** The kind gate's verdict: reject (wrong item), demote (right area, wrong
 *  role — capped to near, never shown as exact), or null (compatible). */
export interface KindGateVerdict {
  readonly tier: "reject" | "demote";
  readonly reason: string;
}

/**
 * The kind gate (DeepSeek P1): does this ad's kind contradict the hunt's?
 * Returns a verdict, or null when compatible.
 *
 * - different domains («تابلو» vs a mobile-repair hunt) → reject;
 * - same domain, hunting the ITEM («ماشین») but the ad is a part /
 *   accessory / derived / consumable / equipment → reject;
 * - hunting a SUB-KIND («کره بادوم زمینی») → the ad must be the SAME
 *   sub-kind (navid's symmetric بادوم rule: neither direction leaks).
 * - service hunts (serviceHunt): the hunt is about a service — service ads
 *   pass; the service TARGET's kind is compatible too (S3: a fridge-for-sale
 *   ad on a «تعمیر یخچال» hunt is demoted, not rejected); only truly
 *   unrelated kinds (compared against the TARGET) are rejected. This also
 *   covers word-order variants («یخچال تعمیر», R7-redteam P1).
 * - R8 (F4a): a SERVICE ad on a GOODS hunt («امداد باطری ماشین» on a
 *   battery hunt) is a ROLE difference, not a kind contradiction — DEMOTE,
 *   never reject (S3's symmetric completion). Training ads keep the hard
 *   line (F7). The demote tier exists because rolesClash can't see it:
 *   «امداد» is role-unknown, so null would wrongly land on exact.
 * Unknown on either side → null (no gate, never over-filter).
 */
export function kindGateRejects(
  queryKind: string | null,
  adKind: string | null,
  targetKind: string | null = null,
  serviceHunt: boolean = false
): KindGateVerdict | null {
  if (!queryKind || !adKind) return null;
  if (queryKind === adKind) return null;
  if (serviceHunt && targetKind) {
    if (adKind === "service" || adKind === targetKind) return null;
    const [tDom, tRole] = splitKind(targetKind);
    const [aDom, aRole] = splitKind(adKind);
    if (aDom !== tDom) return { tier: "reject", reason: `kind:domain:${adKind}-not-${targetKind}` };
    if (aRole !== tRole) return { tier: "reject", reason: `kind:role:${adKind}-not-${targetKind}` };
    return null;
  }
  // S3: the service target's goods stay (demoted, not rejected).
  if (queryKind === "service" && targetKind && adKind === targetKind) return null;
  // R8 (F4a): service ad on a goods hunt → demote, never reject.
  if (adKind === "service") {
    return { tier: "demote", reason: `kind:demote:service-not-${queryKind}` };
  }
  const [qDom, qRole] = splitKind(queryKind);
  const [aDom, aRole] = splitKind(adKind);
  if (qDom !== aDom) return { tier: "reject", reason: `kind:domain:${adKind}-not-${queryKind}` };
  if (qRole !== aRole) return { tier: "reject", reason: `kind:role:${adKind}-not-${queryKind}` };
  return null;
}

/**
 * The hunt's subject kind: longest content-phrase match in the lexicon
 * first («آموزش تعمیرات موبایل» is TRAINING, not a service hunt —
 * the explicit subject wins); service intent as fallback; then the
 * Divar category bridge; else null (no gate).
 */
export function queryKindForDef(
  include: string[],
  serviceIntent: boolean,
  category: string
): string | null {
  const phrase = include.join(" ");
  // First honor the existing subject-first contract. If no subject opens
  // the phrase, strip only leading generic listing modifiers (e.g. «فروش»)
  // and retry. Do not search arbitrary interior words: service intent and
  // compounds must retain their established precedence.
  const findOpeningKind = (candidate: string): string | null => {
    let best: string | null = null;
    let bestLen = 0;
    for (const key of Object.keys(HEAD_KIND)) {
      if ((candidate === key || candidate.startsWith(`${key} `)) && key.length > bestLen) {
        best = HEAD_KIND[key];
        bestLen = key.length;
      }
    }
    return best;
  };
  let best = findOpeningKind(phrase);
  if (!best) {
    const subjectTokens = [...include];
    while (subjectTokens.length > 0 && HEAD_SKIP_TOKENS.has(subjectTokens[0])) {
      subjectTokens.shift();
    }
    if (subjectTokens.length !== include.length) {
      best = findOpeningKind(subjectTokens.join(" "));
    }
  }
  if (best) return best;
  if (serviceIntent) return "service";
  const catMap: Record<string, string> = {
    vehicles: "vehicle",
    mobile: "mobile",
    home: "home-goods",
    "real-estate": "realestate",
  };
  return catMap[category] ?? null;
}

/** Service words — never the service TARGET («تعمیر یخچال» targets یخچال). */
const SERVICE_WORDS = new Set([
  "تعمیر",
  "تعمیرات",
  "تعمیرکار",
  "نصب",
  "نصاب",
  "سرویس",
  "امداد",
  "آموزش",
  "اموزش",
  "تخصصی",
]);

/**
 * The service TARGET's kind («تعمیر یخچال» → appliance): the last
 * non-service content term's kind. On service hunts the target's goods
 * are DEMOTED (S3), never hard-rejected — only truly unrelated kinds
 * («تابلو» on a mobile-repair hunt) get rejected.
 */
export function targetKindForDef(include: string[]): string | null {
  const toks = include.filter((t) => !SERVICE_WORDS.has(t));
  for (let i = toks.length - 1; i >= 0; i--) {
    if (i > 0) {
      const two = `${toks[i - 1]} ${toks[i]}`;
      if (HEAD_KIND[two] !== undefined) return HEAD_KIND[two];
    }
    if (HEAD_KIND[toks[i]] !== undefined) return HEAD_KIND[toks[i]];
  }
  return null;
}
