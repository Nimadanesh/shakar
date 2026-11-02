import { normalizePersian } from "@/lib/normalizePersian";
import { DIVAR_CITIES } from "@/lib/divarCities";
import type { Interpretation, InterpretedConstraint } from "@/types/search";

/** Cities the interpreter can spot inside query text. Exported for the
 * server-side query resolver (definition.ts) — the same vocabulary must
 * decide what is a city in both places.
 *
 * The full Divar directory (1177 cities, generated from
 * /v8/places/cities — see scripts/fetch-divar-cities.mjs), so smaller
 * cities like بناب are detected instead of forcing users to hack the
 * city in as a «باید» chip (incident 2026-10-09: a city chip starves
 * retrieval instead of scoping it). */
export const KNOWN_CITIES: Array<{ id: string; names: string[] }> = DIVAR_CITIES;

/**
 * Word-boundary city mention check. Plain substring matching would fire
 * «رشت» inside «درشت» — with 28 cities in the lexicon that class of false
 * positive is no longer negligible. Persian words are space-separated
 * (ZWNJ stays inside a word), so (^|\s)…(\s|$) is the right boundary.
 */
/** City-name check — a thin wrapper over the shared word-boundary helper. */
function mentionsCity(normalized: string, name: string): boolean {
  return includesWordSmart(normalized, name);
}

const UNIT_MULTIPLIER: Array<{ unit: string; factor: number }> = [
  { unit: "میلیارد", factor: 1_000_000_000 },
  { unit: "میلیون", factor: 1_000_000 },
  // HANDOFF-4 (2026-11-01): typo-tolerant million units, same factor.
  // "میل" counts only when a price pattern (cue + number) precedes it,
  // so «میل لنگ» is never a price.
  { unit: "میلون", factor: 1_000_000 },
  { unit: "ملیون", factor: 1_000_000 },
  { unit: "ملییون", factor: 1_000_000 },
  // HANDOFF-5 (2026-11-02): ملیارد (milliard typo) and تومن (Toman
  // spelling) are money units too; تومان/تومن factor is 1 (Toman is
  // the internal unit).
  { unit: "ملیارد", factor: 1_000_000_000 },
  { unit: "میل", factor: 1_000_000 },
  { unit: "هزار", factor: 1_000 },
  { unit: "تومان", factor: 1 },
  { unit: "تومن", factor: 1 },
];

const MAX_PATTERNS = ["زیر", "حداکثر", "تا", "کمتر از", "پایین‌تر از", "پایین تر از"];
const MIN_PATTERNS = ["بالای", "بیشتر از", "حداقل"];
/**
 * Every word that can appear in a price expression but never names the item
 * («زیر», «میلیون», «تومان»…). Exported for the server query resolver —
 * these are structural, never content terms.
 */
export const PRICE_STRUCTURAL_WORDS = [
  ...MAX_PATTERNS,
  ...MIN_PATTERNS,
  "میلیارد",
  "میلیون",
  "میلون",
  "ملیون",
  "ملییون",
  "ملیارد",
  "میل",
  "هزار",
  "تومان",
  "تومن",
  "ت",
];
/** Negation verbs («نه», «نمی‌خوام»…) — cue words, never content. Exported for the server query resolver. */
export const NEGATION_VERBS = ["نمی‌خوام", "نمیخوام", "نمی‌خواهم", "نمیخواهم", "نمی‌خواد", "نمیخواد", "نه"];
/**
 * Demand verbs («می‌خوام»…) — the WANT, never the wanted item. R3
 * (2026-10-17): «نصاب کولر گازی می‌خوام» left a stray «می» MUST term that
 * capped 8 exact-worthy results to near (missingInfo=["می"]). Structural,
 * never content — the positive mirror of NEGATION_VERBS.
 */
export const DEMAND_VERBS = ["می‌خوام", "میخوام", "می‌خواهم", "میخواهم", "می‌خواهد", "میخواهد"];
/** Prefixes that turn the rest of a segment into an exclude term. Exported for the server query resolver. */
export const EXCLUDE_PREFIXES = ["بدون", "به‌جز", "بجز", "غیر از", "غیراز"];
/** Cue words that turn the rest of a segment into a preference (ranking-only). Exported for the server query resolver. */
export const PREFERENCE_CUES = ["ترجیحاً", "ترجیحا", "کاش", "ای کاش"];

/** Words that pin a real-estate hunt to rent vs buy. Checked on the
 *  normalized query; «اجاره» also matches «اجاره‌ای». */
const RENT_WORDS = ["اجاره", "اجاره‌ای", "رهن", "ودیعه"];
const BUY_WORDS = ["خرید", "فروش", "فروشی", "معاوضه", "وام", "وامدار"];
// R4 (2026-10-17): «وام» یعنی خرید — «آپارتمان بدون وام» آپارتمان فروشی
// می‌خواهد نه اجاره‌ای (نمره‌ی انسانی: اجاره‌ای‌ها ۰ گرفتند). «وامدار» هم
// فروش است («آپارتمان وامدار»). «ودیعه» همیشه اجاره است و چون RENT اول
// چک می‌شود، «وام ودیعه» درست به rent می‌رسد نه buy.

/** Words that answer the goods «condition» dimension (نو / کارکرده). */
const CONDITION_NEW_WORDS = ["نو", "آکبند", "صفر"];
const CONDITION_USED_WORDS = ["کارکرده", "دست دوم", "دست‌دوم"];

/**
 * Word-boundary substring check for Persian text. Plain includes() would
 * match «نو» inside «نوع» and «رشت» inside «درشت» — with ~30 cities and
 * short condition words in play, that class of false positive is no
 * longer negligible. Persian words are space-separated (ZWNJ stays inside
 * a word), so (^|\s)…(\s|$) is the right boundary.
 */
export function includesWord(normalized: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalized);
}

/**
 * Separator-agnostic word matcher (R3 battery round 2, 2026-10-16).
 * Many Persian keyboards lack ZWNJ, so «لپ تاپ», «لپ‌تاپ» and «لپتاپ» must
 * all match the same list entry — but the input is never blindly squashed:
 * «قهوه‌ساز» must not match «ساز» (regression in interpret.test.ts).
 * Instead the input is indexed as tokens:
 * - split on whitespace (ZWNJ stays inside tokens),
 * - every token also indexed ZWNJ-stripped («لباس‌شویی» ≡ «لباسشویی»),
 * - adjacent pairs also indexed joined («لپ»+«تاپ» → «لپتاپ»),
 * - possessive/plural suffixes stripped («پرایدم»→«پراید»، «پرایدها»→«پراید»;
 *   stem must be >=4 chars so «نام»/«شام»/«تنها» never stem).
 * A list word matches iff its ZWNJ-stripped form EQUALS an indexed token —
 * never substring — so short words can't fire inside compounds. Multi-word
 * list entries («موتور برق») match a consecutive token run.
 */
const ZWNJ_RE = /\u200C/g;

/**
 * Canonical token form: ZWNJ stripped + Alef-with-madda folded to bare
 * Alef — mirroring normalizePersian, so list words («آیفون») and folded
 * input («ایفون») meet on the same form. Applied to BOTH sides.
 */
function foldToken(t: string): string {
  return t.replace(ZWNJ_RE, "").replace(/آ/g, "ا");
}

function indexTokens(normalized: string): Set<string> {
  const toks = normalized.split(/\s+/).filter(Boolean);
  const idx = new Set<string>();
  const push = (t: string) => {
    const z = foldToken(t);
    if (z !== "") idx.add(z);
    // conservative stem: possessive م/ت/ش/مان/تان/شان + plural ها/های
    const stem = z.replace(/(مان|تان|شان|های|ها|[متش])$/, "");
    if (stem.length >= 4 && stem !== z) idx.add(stem);
  };
  toks.forEach(push);
  for (let i = 0; i + 1 < toks.length; i++) {
    const joined = foldToken(toks[i] + toks[i + 1]);
    if (joined !== "") idx.add(joined);
  }
  return idx;
}

export function includesWordSmart(normalized: string, word: string): boolean {
  const w = foldToken(word);
  if (!w.includes(" ")) {
    if (indexTokens(normalized).has(w)) return true;
    // Last resort for a SINGLE ZWNJ-joined token («ماشین‌لباسشویی»):
    // a LONG list word (6+ chars) may sit inside the one folded token.
    // Restricted to single-token inputs: joining across spaces creates
    // phantom words («تعمیر یخچال» → «تعمیری» via یخچال's ی).
    // Short words stay token-only — «ساز» must never match «قهوهساز».
    if (w.length >= 6 && !/\s/.test(normalized)) {
      if (foldToken(normalized).includes(w)) return true;
    }
    return false;
  }
  const parts = w.split(/\s+/);
  const toks = normalized.split(/\s+/).filter(Boolean).map(foldToken);
  return toks.some((_, i) => parts.every((p, j) => toks[i + j] === p));
}

/** Back-compat alias — the separator-tolerant entry point used across the classifier. */
export const includesWordZwnjTolerant = includesWordSmart;
/** Real-estate mentions that make the transaction type (rent/buy) a
 *  required disambiguation when no transaction word is present. */
const REAL_ESTATE_WORDS = [
  "خونه",
  "خانه",
  "آپارتمان",
  "آپارتمانی",
  "ویلا",
  "ویلایی",
  "زمین",
  "مغازه",
  "دفتر",
  "سوئیت",
  "پنتهاوس",
  "پنت‌هاوس",
  "ملک",
  "برج",
  "کلنگی",
  "مسکونی",
  "تجاری",
  "ساختمان", // battery #1: «پیش‌فروش ساختمان» — «پیش‌فروش» alone stays out (car pre-sales)
];

export type TransactionType = "rent" | "buy";

/** «خونه اجاره‌ای» → "rent", «آپارتمان فروشی» → "buy", else null.
 *  Word-boundary (never substring): plain includes() matched «زمین» inside
 *  «بادام زمینی» and misclassified a peanut hunt as real estate (2026-10-15
 *  prod incident). Inflected forms («فروشی», «اجاره‌ای») are listed
 *  explicitly instead. */
export function detectTransaction(raw: string): TransactionType | null {
  const normalized = normalizePersian(raw);
  if (RENT_WORDS.some((w) => includesWord(normalized, w))) return "rent";
  if (BUY_WORDS.some((w) => includesWord(normalized, w))) return "buy";
  return null;
}

/** True when the query talks about real estate (خونه، آپارتمان، …).
 *  Word-boundary (never substring): see detectTransaction note above.
 *  «ویل»/«پنت» were substring stems — replaced with their real surface
 *  forms («ویلا»، «پنتهاوس» incl. the ZWNJ spelling).
 *  «دفتر» is ambiguous (office vs notebook): «دفتر مشق/یادداشت» is
 *  stationery, never real estate — the peanut family (2026-10-15). */
const NOTEBOOK_WORDS = ["مشق", "یادداشت"];
/**
 * Real-estate false friends (battery #56/#57, peanut family): landmarks and
 * venues that contain a real-estate word but are not property —
 * «برج میلاد», «خانه بازی کودکان».
 */
const REAL_ESTATE_FALSE_FRIENDS = ["میلاد", "خانه بازی"];
export function mentionsRealEstate(raw: string): boolean {
  const normalized = normalizePersian(raw);
  if (NOTEBOOK_WORDS.some((w) => includesWordZwnjTolerant(normalized, w))) return false;
  if (REAL_ESTATE_FALSE_FRIENDS.some((w) => includesWordZwnjTolerant(normalized, w))) return false;
  return REAL_ESTATE_WORDS.some((w) => includesWordZwnjTolerant(normalized, w));
}

export type ConditionType = "new" | "used";

/**
 * «آیفون نو» → "new", «مبل کارکرده» / «گوشی دست دوم» → "used", else null.
 * Used-words are checked first: they are long and unambiguous, while «نو»
 * and «صفر» are short. Every match is word-boundary («نوع» ≠ «نو»).
 */
export function detectCondition(raw: string): ConditionType | null {
  const normalized = normalizePersian(raw);
  if (CONDITION_USED_WORDS.some((w) => includesWordSmart(normalized, w))) return "used";
  if (CONDITION_NEW_WORDS.some((w) => includesWordSmart(normalized, w))) return "new";
  return null;
}

/**
 * Service-demand cues — words where the user wants a SERVICE performed,
 * not a good (HumanTest S3, flaw #21: «تعمیر یخچال» must find repairers,
 * not fridges for sale). Word-boundary on the normalized query.
 * Conservative seed — grows from real hunt data, like SYNONYM_GROUPS.
 */
const SERVICE_DEMAND_WORDS = ["تعمیر", "تعمیرات", "تعمیرکار", "نصب", "نصاب", "نصب‌کننده"];
// R3 battery #12: «نصبکننده» (joined) — smart matcher covers نصب‌کننده/نصب کننده/نصبکننده

/**
 * Repaired-goods forms — the Q4 guard. «یخچال تعمیری» / «تعمیرشده» reads as
 * a repaired GOOD for sale, never as service demand. Checked on SURFACE
 * forms first: the stemmer would conflate «تعمیری»→«تعمیر», so this must
 * run before any stemmed cue check.
 */
const REPAIRED_GOODS_FORMS = ["تعمیری", "تعمیرشده", "تعمیر شده"];

/**
 * «تعمیر یخچال» → true (wants a repair service); «تعمیرکار یخچال» → true;
 * «نصاب کولر گازی» → true; «یخچال تعمیری» → false (repaired fridge, Q4);
 * «یخچال» → false. The repaired-goods guard runs first on surface forms.
 */
export function detectServiceIntent(raw: string): boolean {
  const normalized = normalizePersian(raw);
  if (REPAIRED_GOODS_FORMS.some((w) => includesWordSmart(normalized, w))) return false;
  // A repair word inside a negated item-history statement is an attribute,
  // not a request to hire a repairer: «پیانو تعمیر یا تعویض نشده است».
  if (/(?:تعمیر|تعمیرات|تعویض)(?:\s+یا\s+(?:تعمیر|تعمیرات|تعویض))?\s+(?:نشده|نشد|ندارد|نکرده|نمی\s?شود)(?:\s+است)?/.test(normalized)) {
    return false;
  }
  return SERVICE_DEMAND_WORDS.some((w) => includesWordSmart(normalized, w));
}

/** True when a MUST term is a service-demand cue (satisfiable by provider forms). */
export function isServiceDemandTerm(term: string): boolean {
  const normalized = normalizePersian(term);
  return SERVICE_DEMAND_WORDS.some((w) => includesWord(normalized, w));
}

/**
 * Morphological family of the service demand — a demand MUST term is
 * satisfied when ANY of these appears in the ad text. This is what makes
 * «تعمیرکار یخچال» satisfy the «تعمیر» in «تعمیر یخچال» (token-level
 * matching alone is blind to the agentive form — the S3 root cause).
 */
export const SERVICE_DEMAND_FAMILY = [...SERVICE_DEMAND_WORDS];

/**
 * Provider/agentive cues in AD text — the supply side of service intent.
 * Used for the ranking boost. Tight on purpose:
 * - «خدمات» alone is too broad («خدمات پس از فروش» appears on goods ads);
 * - «در محل» / «در منزل» are location phrases sellers also use
 *   («بازدید در محل») — they must not shield a goods ad from the
 *   goods penalty, so they are NOT provider cues. A genuine mobile
 *   repairer almost always also names the trade (تعمیرکار/تعمیرات/…),
 *   which the demand-family MUST satisfaction already rewards.
 */
export const SERVICE_PROVIDER_CUES = [
  "تعمیرکار",
  "تعمیرات",
  "سرویسکار",
  "نصاب",
];

/**
 * Goods-for-sale cues — when a service-intent hunt meets an ad carrying
 * these and NO provider cue, the ad is a good, not a service (HumanTest S3
 * rubric: refrigerator-for-sale = 0). Tight on purpose: «قیمت» also
 * appears in legitimate service ads («قیمت توافقی»).
 */
export const GOODS_SALE_CUES = ["فروش", "آکبند"];

/**
 * Needs-the-service cues — the Q1 case: «یخچال خراب نیازمند تعمیر» is a
 * GOOD needing repair (for sale), not a repair provider. On a service
 * hunt, an ad carrying these with NO provider cue is demoted like a
 * goods ad. The providerHits===0 guard keeps legitimate providers safe
 * («یخچال خراب خود را به ما بسپارید» still has تعمیرکار).
 */
export const NEEDS_REPAIR_CUES = ["خراب", "نیازمند", "نیاز به"];

/**
 * Role words — خریدار/فروشنده name a TRANSACTION ROLE, not an item
 * (HumanTest S4, flaw #22). They must never become MUST content terms:
 * «خریدار یخچال» wants seller listings, and matching خریدار as a keyword
 * returns competing dealers — exactly backwards (intent inversion).
 * Direction itself cannot be guessed from query text (decision bank Q6) —
 * the hunt form captures it explicitly; the engine just stops misreading
 * the role word as the wanted item.
 */
export const ROLE_WORDS = [
  "خریدار",
  "خریدارم",
  "خریداریم",
  "فروشنده",
  "فروشنده‌ام",
  "فروشنده‌ایم",
];

/**
 * Dealer cues in AD text — the advertiser is a buyer/dealer («خریدارم»),
 * not an end buyer (decision bank Q7). For a hunter seeking sellers these
 * are competitors (S4 rubric = 0). Fixed phrases plus the proximity rule
 * («خریدار یخچال هستیم» — buyer word + first-person marker, not
 * necessarily adjacent). Bare «هستیم» alone is never enough.
 */
export const DEALER_CUES = [
  "خریدارم",
  "خریداریم",
  "خریدار هستیم",
  "خریدار می‌باشیم",
  "خریدار میباشیم",
];

/** First-person markers that turn a nearby «خریدار» into a dealer signal. */
export const DEALER_FIRST_PERSON = ["هستیم", "هستم", "می‌باشیم", "میباشیم"];

/**
 * Speech-act role of the query — WHOSE ads the hunter wants (R7,
 * 2026-10-18; navid's R6 product decision on «خریدار پراید»).
 * - "seek-buyer": bare «خریدار X» — the hunter is a seller looking for
 *   BUYERS (people), not the goods.
 * - "seek-seller": bare «فروشنده X» — the hunter is a buyer looking for
 *   sellers (the goods, from sellers).
 * - "self-buyer": «خریدار X هستم/م» / «X میخرم» — the hunter IS the buyer
 *   → wants the goods (sellers).
 * - "self-seller": «فروشنده X هستم/م» / «X میفروشم» — the hunter IS the
 *   seller → wants buyers.
 * - "none": no role language — the default goods hunt.
 */
export type RoleMode = "seek-buyer" | "seek-seller" | "self-buyer" | "self-seller" | "none";

/** First-person possessive forms of «فروشنده» (ZWNJ + joined). */
const SELLER_SELF_FORMS = ["فروشنده‌ام", "فروشندهام", "فروشنده‌ایم", "فروشندهایم"];
/** Spaced possessive: «فروشنده ام» / «فروشنده ایم». */
const SELLER_SELF_SPACED = /فروشنده\s+ای?م(\s|$)/;
/** First-person verb forms that declare the hunter's own side. */
const SELF_BUYER_VERBS = ["میخرم", "می خرم"];
const SELF_SELLER_VERBS = ["میفروشم", "می فروشم"];
const SELF_COPULA = ["هستم", "هستیم"];

/**
 * Detect the query's speech-act role. Closed morphological classes only
 * (role nouns + first-person/copula/verb forms) — never guessed from
 * open vocabulary. Both roles present («خریدار و فروشنده») → "none"
 * (ambiguous, never silently resolved).
 */
export function detectRoleMode(raw: string): RoleMode {
  const normalized = normalizePersian(raw);
  const hasBuyer =
    includesWordSmart(normalized, "خریدار") ||
    includesWordSmart(normalized, "خریدارم") ||
    includesWordSmart(normalized, "خریداریم");
  // R7-redteam P2: the possessive lives in hasSeller itself, not only in
  // selfDeclared — «یخچال فروشندهام» and «یخچال فروشنده ام» are self-sellers,
  // not seek-sellers.
  const hasSeller =
    includesWordSmart(normalized, "فروشنده") ||
    SELLER_SELF_FORMS.some((f) => normalized.includes(f)) ||
    SELLER_SELF_SPACED.test(normalized);
  if (hasBuyer && hasSeller) return "none";
  const selfDeclared =
    SELF_COPULA.some((w) => includesWordSmart(normalized, w)) ||
    includesWordSmart(normalized, "خریدارم") ||
    includesWordSmart(normalized, "خریداریم") ||
    SELLER_SELF_FORMS.some((f) => normalized.includes(f)) ||
    SELLER_SELF_SPACED.test(normalized);
  const selfBuys = SELF_BUYER_VERBS.some((w) => includesWordSmart(normalized, w));
  const selfSells = SELF_SELLER_VERBS.some((w) => includesWordSmart(normalized, w));
  if ((hasBuyer && selfDeclared) || selfBuys) return "self-buyer";
  if ((hasSeller && selfDeclared) || selfSells) return "self-seller";
  if (hasBuyer) return "seek-buyer";
  if (hasSeller) return "seek-seller";
  return "none";
}

/** Head-word hints for the required-dimensions engine. Explicit category
 *  picker wins; these only fire when the user never touched it.
 *
 * Vehicles are split (battery #10/#11): STRONG words are unambiguous
 * («کامیون یخچال‌دار», «پژو پارس کولر‌دار» stay vehicles even with an
 * appliance word present); AMBIGUOUS words («ماشین», «موتور», «تیپ»)
 * still honor the disqualifiers («ماشین لباسشویی» → home). */
const VEHICLE_STRONG_WORDS = [
  "خودرو", "اتومبیل", "وانت", "پراید", "پژو", "سمند", "دنا", "تیبا",
  "کوییک", "شاهین", "ساینا", "رانا", "تویوتا", "هیوندای", "نیسان", "کامیون",
  "موتورسیکلت",
  "لندکروزر", "بنز", // battery #8/#9
];
const VEHICLE_AMBIGUOUS_WORDS = ["ماشین", "موتور", "تیپ"];
const VEHICLE_HINT_WORDS = [...VEHICLE_STRONG_WORDS, ...VEHICLE_AMBIGUOUS_WORDS];
const MOBILE_HINT_WORDS = [
  "گوشی", "موبایل", "آیفون", "سامسونگ", "شیائومی", "هواوی", "تبلت",
  "لپتاپ", "لپ‌تاپ",
  "کامپیوتر", "رایانه", "مانیتور", "کنسول",
  "مودم", "پرینتر", "دوربین", "عکاسی", "اسپیکر", "هدفون", "هندزفری",
  "شارژر", "پاوربانک", "پاور بانک", // battery #14: spaced form users type
  "مک‌بوک", "آیپد", "ایرپاد", "گلکسی",
  "هدست", "موس", "مونوپاد", // battery #15/#17/#18
];
const HOME_HINT_WORDS = [
  "مبل", "مبلمان", "یخچال", "فریزر", "تلویزیون", "لباسشویی", "ظرفشویی",
  "رختشویی", // R3 battery #54
  "کولر", "فرش", "قالی", "موکت", "پرده", "تخت", "تختخواب", "کمد", "دراور",
  "صندلی", "جاروبرقی", "بخارشوی", "اتو", "آباژور", "لوستر", "آینه", "میز",
  "بخاری", "آبگرمکن", "هود", "اجاق", "فر", "سرویس خواب",
  "پکیج دیواری", // phrase only: bare «پکیج» also means course package
  "ساعت دیواری", // battery #23: wall clock is home, not personal «ساعت»
  "اسپرسوساز", // battery #24: «ماشین اسپرسوساز» is an appliance
  "کاغذ دیواری", "چرخ گوشت", // battery #21/#22
];
/**
 * سرگرمی و فراغت (Divar: leisure-hobbies). NOTE: the TextCategory id stays
 * "music" (historical — persisted in kamin-store; renaming would orphan
 * stored kamins). The label is «سرگرمی و فراغت» and the words cover the
 * whole parent category, not just instruments.
 */
const LEISURE_HINT_WORDS = [
  "پیانو", "گیتار", "ویولن", "ویولون", // battery #27: spelling variant
  "سنتور", "سهتار", "سه تار", "سه‌تار", // battery #28: all three spellings users type
  "دف", "تنبک", "درام",
  "ساز", "آکوستیک", "کتاب", "دوچرخه", "اسکوتر",
  "اسباب‌بازی",
  "پازل",
  "شطرنج",
  "لگو", "ماهیگیری", "تلسکوپ", // battery #26/#29/#30
];
const PERSONAL_HINT_WORDS = [
  "مانتو", "پالتو", "بارانی", "کاپشن", "شلوار", "پیراهن", "تیشرت",
  "کفش", "کتونی", "بوت", "صندل", "کیف", "کوله", "کوله‌پشتی", // battery #36
  "چمدان", "عینک",
  "ساعت", "طلا", "جواهر", "انگشتر", "گردنبند", "دستبند", "عطر", "ادکلن",
  "لباس", "شال", "روسری", "کمربند", "کلاه",
  "ماشین اصلاح", // battery #31: electric razor — phrase beats «ماشین»→vehicles
  "اتوی", // battery #32: ezafe form «اتوی مو» ≠ «اتو»
  "شلوارک", // battery #33: whole-word «شلوارک» ≠ «شلوار»
];

/** Jobs (Divar: استخدام و کاریابی). Unambiguous — never a goods modifier. */
const JOBS_HINT_WORDS = [
  "استخدام",
  "کاریابی",
  "شغلی", // battery #44: «فرصت شغلی»
  "کارآموز", // battery #45
  "کارمند", // battery #46
  "دستیار", // battery #47
];

/**
 * Business / industrial equipment (Divar: کسب‌وکار و تجهیزات).
 * Phrase-only: bare «دستگاه» is hopelessly ambiguous (دستگاه قهوه‌ساز
 * is home, دستگاه تزریق پلاستیک is industrial).
 */
const INDUSTRIAL_HINT_WORDS = [
  "ماشین‌آلات",
  "تجهیزات صنعتی",
  "خط تولید",
  "موتور برق", // battery #50: generator
  "کمپرسور", // battery #51
  "دیگ بخار", // battery #52
  "دریل", // battery #53
  "خط بسته‌بندی", // battery #54
];

/**
 * Standalone service words — unambiguous service hunts with no goods
 * involved. Deliberately NOT «نظافت» («دستگاه نظافت صنعتی» is a good)
 * and NOT «آموزش» («کتاب آموزش زبان» is a good). Demand patterns
 * (تعمیر/نصب/نصاب) come from detectServiceIntent (P0, Q4-guarded).
 */
const SERVICE_STANDALONE_WORDS = [
  "قالیشویی",
  "باربری",
  "اسباب‌کشی",
  "آرایشگری",
  "خیاطی",
  "تدریس",
  "تعمیرگاه",
  "کارواش", // battery #37
  "خشکشویی", // battery #39
  "نظافت منزل", // battery #40: phrase only — bare «نظافت» stays out (industrial goods)
];

/**
 * «نصب شده» is the state of a GOOD («کولر نصب شده» — an installed AC for
 * sale), never a service demand. Same family as the تعمیری Q4 guard:
 * checked before detectServiceIntent so the category doesn't claim it.
 */
const INSTALLED_FORMS = ["نصب شده", "نصب‌شده"];

/**
 * True when the query hunts a SERVICE, not a good. Runs before every
 * goods category: «تعمیر یخچال» must be services (no «نو یا کارکرده؟»
 * question), while «یخچال تعمیری» stays home via the Q4 guard inside
 * detectServiceIntent.
 */
export function isServicesQuery(raw: string): boolean {
  const normalized = normalizePersian(raw);
  if (INSTALLED_FORMS.some((w) => includesWordZwnjTolerant(normalized, w))) return false;
  if (detectServiceIntent(raw)) return true;
  return SERVICE_STANDALONE_WORDS.some((w) => includesWordZwnjTolerant(normalized, w));
}

/**
 * True when the query hunts a JOB, not a good (battery #43).
 * «استخدام راننده وانت» is a job ad — «وانت» must not steal it into
 * vehicles. Mirrors the services-first pattern: the jobs words are
 * unambiguous (never goods modifiers), so jobs run before goods.
 */
export function isJobsQuery(raw: string): boolean {
  const normalized = normalizePersian(raw);
  return JOBS_HINT_WORDS.some((w) => includesWordZwnjTolerant(normalized, w));
}

export type TextCategory =
  | "real-estate"
  | "vehicles"
  | "mobile"
  | "home"
  | "music" // historical id — covers all of سرگرمی و فراغت (see LEISURE_HINT_WORDS)
  | "personal"
  | "services"
  | "jobs"
  | "industrial";

/**
 * Disambiguation guards (category double-check, 2026-10-15). Some head
 * words are ambiguous even with word boundaries — the compound tells the
 * truth:
 * - «ماشین لباسشویی/ظرفشویی/حساب/اصلاح» is an appliance, not a vehicle.
 * - «سامسونگ» + appliance («یخچال سامسونگ») is home — Samsung makes
 *   fridges too. «گوشی سامسونگ» still hits mobile (no appliance present).
 * - «میز» + «کنسول» is furniture («میز کنسول»), not a game console.
 */
const VEHICLE_DISQUALIFIERS = [
  "لباسشویی",
  "ظرفشویی",
  "رختشویی", // R3 battery #54: synonym of لباسشویی (all separator spellings via smart matcher)
  "حساب",
  "اصلاح",
  "یخچال",
  "فریزر",
  "کولر",
  // «تیپ» is also a clothing style («تیپ مردانه») — never a car then.
  "مردانه",
  "زنانه",
  // battery: compounds that beat the ambiguous «ماشین»/«موتور»
  "ماشین‌آلات", // «ماشین آلات صنعتی» → industrial (spaced form via ZWNJ tolerance)
  "موتور برق", // «موتور برق دیزلی» → industrial generator
  "اسپرسوساز", // «ماشین اسپرسوساز» → home appliance
];
const MOBILE_DISQUALIFIERS = [
  "یخچال",
  "فریزر",
  "تلویزیون",
  "لباسشویی",
  "ظرفشویی",
  "میز",
  "کولر", // battery #19: «کولر گازی سامسونگ» is an AC, not a phone
];

/**
 * Cross-category brands (battery #55, never-guess): a bare «سامسونگ»
 * spans phones, fridges and TVs — the engine must not guess mobile.
 * With a category word («یخچال سامسونگ», «گوشی سامسونگ») that word decides.
 */
const BRAND_WORDS = ["سامسونگ", "شیائومی", "هواوی", "الجی", "سونی"];
const ALL_GOODS_WORDS = [
  ...VEHICLE_HINT_WORDS,
  ...MOBILE_HINT_WORDS,
  ...HOME_HINT_WORDS,
  ...LEISURE_HINT_WORDS,
  ...PERSONAL_HINT_WORDS,
  ...INDUSTRIAL_HINT_WORDS,
  ...JOBS_HINT_WORDS,
  ...SERVICE_STANDALONE_WORDS,
];
const NON_BRAND_GOODS_WORDS = ALL_GOODS_WORDS.filter((w) => !BRAND_WORDS.includes(w));

/**
 * Best-guess category from free text for the required-dimensions engine.
 * Real estate first (preserves the #4 transaction behavior), then goods.
 * Null when nothing matches — the engine stays silent rather than guess.
 */
export function detectCategoryFromText(raw: string): TextCategory | null {
  const normalized = normalizePersian(raw);
  const hits = (words: string[]) => words.some((w) => includesWordZwnjTolerant(normalized, w));
  // Services first: «تعمیر یخچال» is a repairman hunt, not a fridge hunt —
  // it must not fall through to home and ask «نو یا کارکرده؟».
  if (isServicesQuery(raw)) return "services";
  // Jobs second (battery #43): «استخدام راننده وانت» is a job ad —
  // «وانت» must not steal it into vehicles. Jobs words are unambiguous.
  if (isJobsQuery(raw)) return "jobs";
  if (mentionsRealEstate(raw)) return "real-estate";
  // Strong vehicle words beat disqualifiers (battery #10/#11):
  // «کامیون یخچال‌دار» and «پژو پارس کولر‌دار» are vehicles, full stop.
  if (hits(VEHICLE_STRONG_WORDS)) return "vehicles";
  if (hits(VEHICLE_AMBIGUOUS_WORDS) && !hits(VEHICLE_DISQUALIFIERS)) return "vehicles";
  // Bare brands never guess (battery #55, peanut family): «سامسونگ»
  // alone → null. With a category word, that word decides.
  if (hits(BRAND_WORDS) && !hits(NON_BRAND_GOODS_WORDS)) return null;
  if (hits(MOBILE_HINT_WORDS) && !hits(MOBILE_DISQUALIFIERS)) return "mobile";
  if (hits(HOME_HINT_WORDS)) return "home";
  if (hits(LEISURE_HINT_WORDS)) return "music";
  if (hits(PERSONAL_HINT_WORDS)) return "personal";
  if (hits(INDUSTRIAL_HINT_WORDS)) return "industrial";
  return null;
}

function faToEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function parseAmount(raw: string, unit: string | undefined): number | null {
  const digits = faToEnDigits(raw).replace(/[^\d]/g, "");
  if (digits === "") return null;
  const factor = UNIT_MULTIPLIER.find((u) => u.unit === unit)?.factor ?? 1;
  return Number(digits) * factor;
}

const AMOUNT = "([\\d۰-۹٠-٩][\\d۰-۹٠-٩\\s,،.٬]*)";
// HANDOFF-5 (2026-11-02): the unit is REQUIRED — a number is a price
// only with a money unit beside it. Longest first, so «میلیون» is not
// cut to «میل». Before this, the optional unit made «تا ۱۰۰ متری» a
// priceMax of 100 and «رم حداقل ۱۶» a priceMin of 16.
const UNIT = "(میلیارد|میلیون|ملییون|ملیون|میلون|ملیارد|هزار|تومان|تومن|میل|ت)";

// HANDOFF-N: letter-numbers count ONLY immediately before a money unit
// («زیر ده میل» → 10,000,000; «ماشین ده نفره» → no price). The bare «ت»
// unit is deliberately included: «ده ت» converts, while «ده تا» does not
// (the boundary after the unit blocks «تا» from donating its ت).
const LETTER_NUMBERS: Array<[string, number]> = [
  ["صد", 100],
  ["ده", 10],
  ["پنج", 5],
  ["سه", 3],
  ["دو", 2],
  ["یک", 1],
];
const MONEY_UNITS_RE =
  "(میلیارد|میلیون|ملییون|ملیون|میلون|ملیارد|میل|هزار|تومان|تومن|ت)";
function letterNumbersToDigits(text: string): string {
  let out = text;
  for (const [word, digit] of LETTER_NUMBERS) {
    out = out.replace(
      new RegExp(
        `(^|\\s)${word}(?=\\s+${MONEY_UNITS_RE}(\\s|$|[،,.!؟?]))`,
        "g"
      ),
      `$1${digit}`
    );
  }
  return out;
}

function findPriceBound(normalized: string, kind: "min" | "max"): { value: number; display: string } | null {
  // Letter-numbers are digits by the time either scan (hard or preference
  // domain) reads the text, so both scans share the conversion.
  normalized = letterNumbersToDigits(normalized);
  const patterns = kind === "max" ? MAX_PATTERNS : MIN_PATTERNS;
  for (const cue of patterns) {
    // HANDOFF-N: the unit must end at a word boundary. Without it, the
    // bare «ت» unit matched the first letter of «تا» («رم حداقل ۱۶، تا ۴۰
    // میلیون» wrongly set priceMin 16 in sentence 16). A genuine «۵ ت»
    // still works (end of string is a boundary).
    const match = normalized.match(
      new RegExp(`${cue}\\s+${AMOUNT}\\s*${UNIT}(?=\\s|$|[،,.!؟?])`)
    );
    if (!match) continue;
    const value = parseAmount(match[1], match[2]);
    if (value === null) continue;
    const rawAmount = match[1].trim();
    const scaleUnit = ["میلیارد", "میلیون", "میلون", "ملیون", "ملییون", "ملیارد", "میل", "هزار"].includes(match[2]);
    const displayAmount = scaleUnit ? `${rawAmount} ${match[2]}` : `${value.toLocaleString("fa-IR")} تومان`;
    return {
      value,
      display: kind === "max" ? `تا ${displayAmount}` : `از ${displayAmount}`,
    };
  }
  return null;
}

/**
 * HANDOFF-5 (2026-11-02): «ترجیحاً» domains. A preference domain starts
 * after ترجیحاً/ترجیحا and ends at the next «،», a standalone «و» or
 * «حتماً»/«حتما», or the end of the query. A price inside a domain is
 * a SOFT preferred bound, never a hard one; the city after ترجیحاً is
 * untouched (city detection reads the full query, not the blanked one).
 * Spans are character positions so the hard-price scan can blank exactly
 * the domain: blanking with "X" (never a digit, cue, or unit) also blocks
 * a cue outside the domain from reaching a number inside it.
 */
interface PreferenceSpan {
  start: number;
  end: number;
  text: string;
}
function preferenceSpans(normalized: string): PreferenceSpan[] {
  const spans: PreferenceSpan[] = [];
  const cueRe = /(^|\s)(ترجیحاً|ترجیحا)(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = cueRe.exec(normalized)) !== null) {
    const start = m.index + m[1].length + m[2].length;
    let end = normalized.length;
    const commaIdx = normalized.slice(start).search(/[،,]/);
    if (commaIdx >= 0) end = start + commaIdx;
    const after = normalized.slice(start, end);
    let pos = start;
    for (const tok of after.split(" ")) {
      const clean = tok.replace(/[،,]+$/, "");
      if (clean === "و" || clean === "حتماً" || clean === "حتما") {
        end = pos;
        break;
      }
      pos += tok.length + 1;
    }
    const text = normalized.slice(start, end).trim();
    if (text !== "") spans.push({ start, end, text });
  }
  return spans;
}
function blankSpans(text: string, spans: PreferenceSpan[]): string {
  const chars = text.split("");
  for (const s of spans) {
    for (let i = s.start; i < s.end; i++) chars[i] = "X";
  }
  return chars.join("");
}

function splitSegments(normalized: string): string[] {
  return normalized
    .split(/[،,.!؟?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function pushUnique(list: InterpretedConstraint[], item: InterpretedConstraint): void {
  if (!list.some((c) => c.id === item.id)) list.push(item);
}

function addExcludeTerm(
  list: InterpretedConstraint[],
  rawTerm: string,
  opts?: { absent?: boolean }
): void {
  const push = (term: string) => {
    const words = term.split(" ").filter(Boolean);
    if (term !== "" && words.length <= 3) {
      // R3 (2026-10-17): «بدون X» is NOT a search exclusion — it names a
      // desired ABSENCE («ماشین بدون رنگ» wants unpainted cars; banning
      // «رنگ» murdered exactly those ads). The id carries the provenance
      // (`exclude:absent:`) so the resolver can apply absence semantics
      // (polarity-scoped) instead of a hard ban. «نه»/«بجز»/negation verbs
      // stay true exclusions.
      const id = opts?.absent ? `exclude:absent:${term}` : `exclude:${term}`;
      pushUnique(list, {
        id,
        kind: "exclude",
        value: term,
        display: term,
        source: "inferred",
        applied: true,
      });
    }
  };
  const term = normalizePersian(rawTerm);
  // HANDOFF-2 (2026-11-01): a negated phrase is cut at its boundaries, not
  // pushed whole. «و»/«یا»/«نه» (independent words only) split the phrase
  // into separate excludes («نه X و نه Y» → X, Y; «نه X یا Y» → X, Y), so
  // no exclude starts/ends with a conjunction and none is conjunction-only.
  // «،»/«,»/«ولی»/«اما»/«ترجیحاً»/«ترجیحا» STOP the negation: what follows
  // is a new segment, a contrast, or a preference — never another exclude.
  // The negated phrase itself is not fragmented («هندزفری سیم‌دار ارزان»
  // stays one exclude). The ≤3-word push cap above is unchanged, so a
  // long piece with no boundary still drops exactly as before.
  const pieces: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) pieces.push(current.join(" "));
    current = [];
  };
  const STOP = new Set(["ترجیحاً", "ترجیحا", "ولی", "اما"]);
  const SPLIT = new Set(["و", "یا", "نه"]);
  for (const rawTok of term.split(" ").filter(Boolean)) {
    const hasComma = /[،,]$/.test(rawTok);
    const tok = rawTok.replace(/[،,]+$/, "");
    if (tok === "") {
      flush();
      break;
    }
    if (STOP.has(tok)) {
      flush();
      break;
    }
    if (SPLIT.has(tok)) {
      flush();
      if (hasComma) break;
      continue;
    }
    current.push(tok);
    if (hasComma) {
      flush();
      break;
    }
  }
  flush();
  for (const piece of pieces) push(piece);
}

/**
 * HANDOFF-4 (2026-11-01): suffix negation. A marker at the end of a
 * clause («X نباشه», «X نیست») is a hard exclude for X; «X نداشته باشه»
 * / «X نداره» is a soft absence, like «بدون X». Markers are independent
 * words only — «نیستان» (contains «نیست» as a substring) never fires.
 * «بدون X نباشه» is a double negation: X is inert, so no constraint is
 * pushed here at all (definition.ts strips X from include).
 */
const SUFFIX_HARD = new Set(["نباشه", "نباشد", "نیست", "نیستش"]);
const SUFFIX_SOFT: ReadonlyArray<readonly string[]> = [
  ["نداشته", "باشه"],
  ["نداشته", "باشد"],
  ["نداره"],
];
const SUFFIX_BOUNDARIES = new Set([
  "حتماً", "حتما", "ترجیحاً", "ترجیحا", "و", "یا", "نه", "ولی", "اما",
  "نباشه", "نباشد", "نیست", "نیستش", "نداشته", "نداره",
]);
const SUFFIX_WEAK = new Set(["دار", "ای", "ها", "های", "تر", "ترین"]);
const SUFFIX_ORDINALS = new Set([
  "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم",
  "یازدهم", "دوازدهم", "یکم",
]);
function suffixWeakToken(tok: string): boolean {
  const clean = tok.replace(/‌/g, "");
  if (/^[\d۰-۹٠-٩]+$/.test(clean)) return true;
  if (SUFFIX_ORDINALS.has(clean)) return true;
  if (clean.length <= 2) return true;
  return SUFFIX_WEAK.has(clean);
}
function findSuffixMarker(tokens: string[]): {
  kind: "hard" | "soft" | "double";
  start: number;
  length: number;
} | null {
  for (let i = 0; i < tokens.length; i++) {
    let kind: "hard" | "soft" | null = null;
    let length = 0;
    if (SUFFIX_HARD.has(tokens[i])) {
      kind = "hard";
      length = 1;
    } else {
      for (const seq of SUFFIX_SOFT) {
        if (seq.every((t, k) => tokens[i + k] === t)) {
          kind = "soft";
          length = seq.length;
          break;
        }
      }
    }
    if (kind === null) continue;
    const after = tokens.slice(i + length);
    const clauseEnd =
      after.length === 0 ||
      ["ترجیحاً", "ترجیحا", "و", "یا", "ولی", "اما", "نه"].includes(after[0]);
    if (!clauseEnd) continue;
    // Double negation: «بدون X نباشه/نباشد» — X is inert, not a ban
    // and not an absence. The marker itself must be نباشه/نباشد.
    if (
      kind === "hard" &&
      (tokens[i] === "نباشه" || tokens[i] === "نباشد") &&
      tokens.slice(0, i).includes("بدون")
    ) {
      return { kind: "double", start: i, length };
    }
    return { kind, start: i, length };
  }
  return null;
}

/**
 * Conservative rule-based interpretation of a Persian natural-language query.
 * Only high-confidence patterns (known city, explicit price bound, explicit
 * negation, preference cue) produce constraints. Vague language yields nothing:
 * unknown stays unknown and the raw query is preserved untouched.
 */
export function interpretQuery(raw: string): Interpretation {
  const applied: InterpretedConstraint[] = [];
  const preferences: InterpretedConstraint[] = [];
  const normalized = normalizePersian(raw);
  if (normalized === "") return { version: "v1", applied, preferences };
  // «بی‌رنگ»/«بیرنگ»/«بی رنگ» reads as «بدون رنگ» (R3 battery #39) —
  // rewrite once so the EXCLUDE_PREFIXES path below handles every spelling.
  const segmentsFrom = normalized.replace(/بی‌رنگ|بیرنگ|بی رنگ/g, "بدون رنگ");

  // HANDOFF-N: a city name with trailing punctuation («تهران،») is the
  // city. Only the city check sees the stripped copy — every other
  // classifier keeps the raw normalized text.
  const cityNormalized = normalized
    .split(" ")
    .map((t) => t.replace(/[،,.]+$/, ""))
    .join(" ");
  for (const city of KNOWN_CITIES) {
    if (city.names.some((name) => mentionsCity(cityNormalized, name))) {
      pushUnique(applied, {
        id: `city:${city.id}`,
        kind: "city",
        value: city.id,
        display: city.names[0],
        source: "inferred",
        applied: true,
      });
      break;
    }
  }

  const transaction = detectTransaction(raw);
  if (transaction) {
    pushUnique(applied, {
      id: `transaction:${transaction}`,
      kind: "transaction",
      value: transaction,
      display: transaction === "rent" ? "اجاره" : "خرید",
      source: "inferred",
      applied: true,
    });
  }

  const condition = detectCondition(raw);
  if (condition) {
    pushUnique(applied, {
      id: `condition:${condition}`,
      kind: "condition",
      value: condition,
      display: condition === "new" ? "نو" : "کارکرده",
      source: "inferred",
      applied: true,
    });
  }

  // HANDOFF-5: hard bounds read the query with «ترجیحاً» domains
  // blanked, so a preferred price can never also become a hard bound.
  // Preferred bounds are soft constraints of kind "preference" with a
  // "preferredPriceMax:/preferredPriceMin:" id — the form (which reads
  // only kind priceMin/priceMax/city/exclude) and the contract (which
  // lifts only kind priceMax/priceMin) both ignore them, and the
  // resolver picks them up by id prefix.
  const prefSpans = preferenceSpans(normalized);
  const hardQuery = blankSpans(normalized, prefSpans);
  const max = findPriceBound(hardQuery, "max");
  if (max) {
    pushUnique(applied, {
      id: `priceMax:${max.value}`,
      kind: "priceMax",
      value: String(max.value),
      display: max.display,
      source: "inferred",
      applied: true,
    });
  }
  const min = findPriceBound(hardQuery, "min");
  if (min) {
    pushUnique(applied, {
      id: `priceMin:${min.value}`,
      kind: "priceMin",
      value: String(min.value),
      display: min.display,
      source: "inferred",
      applied: true,
    });
  }
  for (const kind of ["max", "min"] as const) {
    for (const span of prefSpans) {
      const b = findPriceBound(span.text, kind);
      if (!b) continue;
      pushUnique(applied, {
        id: `preferredPrice${kind === "max" ? "Max" : "Min"}:${b.value}`,
        kind: "preference",
        value: String(b.value),
        display: `ترجیحاً ${b.display}`,
        source: "inferred",
        applied: true,
      });
      break;
    }
  }

  for (const rawSegment of splitSegments(segmentsFrom)) {
    // HANDOFF-4 suffix negation, before the «نه» path (which is untouched).
    // The negated piece is cut at the last boundary; a hard exclude is
    // the last word, or the last two when the last word is weak — never
    // more. A soft marker gives an "exclude:soft:" constraint, which
    // definition.ts merges into absentAttributes (never a hard exclude).
    // A double negation pushes nothing and the segment is skipped.
    {
      const segTokens = rawSegment.split(" ").filter(Boolean);
      const found = findSuffixMarker(segTokens);
      if (found !== null) {
        if (found.kind === "double") {
          continue;
        }
        let cut = 0;
        for (let i = 0; i < found.start; i++) {
          // A soft attribute keeps its internal «و» («خط و خش»); a hard
          // exclude cuts at «و»/«یا» as a clause boundary.
          if (found.kind === "soft" && (segTokens[i] === "و" || segTokens[i] === "یا")) continue;
          if (SUFFIX_BOUNDARIES.has(segTokens[i])) cut = i + 1;
        }
        const piece = segTokens.slice(cut, found.start);
        if (piece.length === 0) {
          continue;
        }
        if (found.kind === "hard") {
          const last = piece[piece.length - 1];
          const term =
            piece.length >= 2 && suffixWeakToken(last)
              ? piece.slice(-2).join(" ")
              : last;
          pushUnique(applied, {
            id: `exclude:${term}`,
            kind: "exclude",
            value: term,
            display: term,
            source: "inferred",
            applied: true,
          });
        } else {
          const term = piece.slice(-4).join(" ");
          pushUnique(applied, {
            id: `exclude:soft:${term}`,
            kind: "exclude",
            value: term,
            display: term,
            source: "inferred",
            applied: true,
          });
        }
        continue;
      }
    }
    // Inline «نه»: «زیر ۲۰۰ میلیون نه دیجیتال» → content + exclude term.
    // The remainder keeps flowing through the other checks (price, city…).
    let segment = rawSegment;
    const innerNeg = segment.indexOf(" نه ");
    if (innerNeg >= 0) {
      addExcludeTerm(applied, segment.slice(innerNeg + 4));
      segment = segment.slice(0, innerNeg);
    } else if (segment.startsWith("نه ")) {
      // Leading «نه» — «نه دیجیتال» reads as naturally as «دیجیتال نه».
      addExcludeTerm(applied, segment.slice(3));
      continue;
    }
    const negation = segment.match(
      new RegExp(`^(.+?)\\s+(${NEGATION_VERBS.join("|")})$`)
    );
    if (negation) {
      addExcludeTerm(applied, negation[1]);
      continue;
    }
    for (const prefix of EXCLUDE_PREFIXES) {
      const marker = `${prefix} `;
      const at = segment.indexOf(marker);
      if (at >= 0) {
        // «بدون» names an absence-attribute, not a ban (see addExcludeTerm).
        addExcludeTerm(applied, segment.slice(at + marker.length), {
          absent: prefix === "بدون",
        });
        break;
      }
    }
    // Leading «نه» — «نه دیجیتال» reads as naturally as «دیجیتال نه».
    if (segment.startsWith("نه ")) {
      addExcludeTerm(applied, segment.slice(3));
      continue;
    }
    for (const cue of PREFERENCE_CUES) {
      const idx = segment.indexOf(cue);
      if (idx >= 0) {
        const wish = normalizePersian(segment.slice(idx + cue.length));
        if (wish !== "") {
          pushUnique(preferences, {
            id: `preference:${wish}`,
            kind: "preference",
            value: wish,
            display: wish,
            source: "inferred",
            applied: false,
          });
        }
        break;
      }
    }
  }

  return { version: "v1", applied, preferences };
}
