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
 */

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
  "آموزش": "training",
  "اموزش": "training", // observed spelling in the wild
  "آموزشگاه": "training",
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
 * The ad's subject kind from its title: skip sale cues, then longest
 * head-NP match (2 tokens, then 1). Returns null when unknown — the gate
 * never fires on unknown (anti-overfilter law).
 */
export function adKindForTitle(title: string): string | null {
  const toks = title.split(/\s+/).filter(Boolean).filter((t) => !HEAD_SKIP_TOKENS.has(t));
  if (toks.length === 0) return null;
  if (toks.length >= 2) {
    const two = `${toks[0]} ${toks[1]}`;
    if (HEAD_KIND[two] !== undefined) return HEAD_KIND[two];
  }
  if (HEAD_KIND[toks[0]] !== undefined) return HEAD_KIND[toks[0]];
  return null;
}

/** Divar category slug → kind fallback (used only when the head is unknown). */
const CATEGORY_KIND: Array<[RegExp, string]> = [
  [/car|vehicle|ماشین/, "vehicle"],
  [/mobile|phone|گوشی/, "mobile"],
  [/real-estate|apartment|املاک/, "realestate"],
  [/home|furniture|مبلمان/, "furniture"],
  [/service|خدمات/, "service"],
];

/** Kind from Divar's category slug — corroboration only, never a hard gate alone. */
export function adKindForCategorySlug(slug: string): string | null {
  if (!slug) return null;
  for (const [re, kind] of CATEGORY_KIND) {
    if (re.test(slug)) return kind;
  }
  return null;
}

function splitKind(kind: string): [string, string] {
  const i = kind.lastIndexOf("-");
  if (i <= 0) return [kind, "item"];
  return [kind.slice(0, i), kind.slice(i + 1)];
}

/**
 * The kind gate (DeepSeek P1): does this ad's kind contradict the hunt's?
 * Returns a rejectedKind reason, or null when compatible.
 *
 * - different domains («تابلو» vs a mobile-repair hunt) → reject;
 * - same domain, hunting the ITEM («ماشین») but the ad is a part /
 *   accessory / derived / consumable / equipment → reject;
 * - hunting a SUB-KIND («کره بادوم زمینی») → the ad must be the SAME
 *   sub-kind (navid's symmetric بادوم rule: neither direction leaks).
 * - service hunts: the service TARGET's kind is compatible too — a
 *   fridge-for-sale ad on a «تعمیر یخچال» hunt is demoted (S3), not
 *   rejected; only truly unrelated kinds are rejected.
 * Unknown on either side → null (no gate, never over-filter).
 */
export function kindGateRejects(
  queryKind: string | null,
  adKind: string | null,
  targetKind: string | null = null
): string | null {
  if (!queryKind || !adKind) return null;
  if (queryKind === adKind) return null;
  // S3: the service target's goods stay (demoted, not rejected).
  if (queryKind === "service" && targetKind && adKind === targetKind) return null;
  const [qDom, qRole] = splitKind(queryKind);
  const [aDom, aRole] = splitKind(adKind);
  if (qDom !== aDom) return `kind:domain:${adKind}-not-${queryKind}`;
  if (qRole !== aRole) return `kind:role:${adKind}-not-${queryKind}`;
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
  // Longest lexicon key that opens the phrase (the subject comes first).
  let best: string | null = null;
  let bestLen = 0;
  for (const key of Object.keys(HEAD_KIND)) {
    if ((phrase === key || phrase.startsWith(`${key} `)) && key.length > bestLen) {
      best = HEAD_KIND[key];
      bestLen = key.length;
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
