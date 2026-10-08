import { normalizePersian } from "@/lib/normalizePersian";
import type { Interpretation, InterpretedConstraint } from "@/types/search";

/** Cities the interpreter can spot inside query text. Exported for the
 * server-side query resolver (definition.ts) — the same vocabulary must
 * decide what is a city in both places. */
export const KNOWN_CITIES: Array<{ id: string; names: string[] }> = [
  { id: "tehran", names: ["تهران"] },
  { id: "karaj", names: ["کرج"] },
  { id: "isfahan", names: ["اصفهان"] },
  { id: "shiraz", names: ["شیراز"] },
  { id: "mashhad", names: ["مشهد"] },
  { id: "tabriz", names: ["تبریز"] },
  { id: "ahvaz", names: ["اهواز"] },
  { id: "qom", names: ["قم"] },
  { id: "kermanshah", names: ["کرمانشاه"] },
  { id: "urmia", names: ["ارومیه", "اورمیه"] },
  { id: "rasht", names: ["رشت"] },
  { id: "zahedan", names: ["زاهدان"] },
  { id: "hamadan", names: ["همدان"] },
  { id: "kerman", names: ["کرمان"] },
  { id: "yazd", names: ["یزد"] },
  { id: "ardabil", names: ["اردبیل"] },
  { id: "bandar-abbas", names: ["بندرعباس", "بندر عباس"] },
  { id: "arak", names: ["اراک"] },
  { id: "zanjan", names: ["زنجان"] },
  { id: "qazvin", names: ["قزوین"] },
  { id: "sanandaj", names: ["سنندج"] },
  { id: "khorramabad", names: ["خرم‌آباد", "خرم آباد"] },
  { id: "gorgan", names: ["گرگان"] },
  { id: "sari", names: ["ساری"] },
  { id: "bushehr", names: ["بوشهر"] },
  { id: "birjand", names: ["بیرجند"] },
  { id: "ilam", names: ["ایلام"] },
  { id: "shahrekord", names: ["شهرکرد"] },
  { id: "yasuj", names: ["یاسوج"] },
  { id: "semnan", names: ["سمنان"] },
  { id: "bojnurd", names: ["بجنورد"] },
  { id: "kashan", names: ["کاشان"] },
  { id: "dezful", names: ["دزفول"] },
  { id: "kish", names: ["کیش"] },
];

/**
 * Word-boundary city mention check. Plain substring matching would fire
 * «رشت» inside «درشت» — with 28 cities in the lexicon that class of false
 * positive is no longer negligible. Persian words are space-separated
 * (ZWNJ stays inside a word), so (^|\s)…(\s|$) is the right boundary.
 */
/** City-name check — a thin wrapper over the shared word-boundary helper. */
function mentionsCity(normalized: string, name: string): boolean {
  return includesWord(normalized, name);
}

const UNIT_MULTIPLIER: Array<{ unit: string; factor: number }> = [
  { unit: "میلیارد", factor: 1_000_000_000 },
  { unit: "میلیون", factor: 1_000_000 },
  { unit: "هزار", factor: 1_000 },
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
  "هزار",
  "تومان",
  "ت",
];
/** Negation verbs («نه», «نمی‌خوام»…) — cue words, never content. Exported for the server query resolver. */
export const NEGATION_VERBS = ["نمی‌خوام", "نمیخوام", "نمی‌خواهم", "نمیخواهم", "نمی‌خواد", "نمیخواد", "نه"];
/** Prefixes that turn the rest of a segment into an exclude term. Exported for the server query resolver. */
export const EXCLUDE_PREFIXES = ["بدون", "به‌جز", "بجز", "غیر از", "غیراز"];
/** Cue words that turn the rest of a segment into a preference (ranking-only). Exported for the server query resolver. */
export const PREFERENCE_CUES = ["ترجیحاً", "ترجیحا", "کاش", "ای کاش"];

/** Words that pin a real-estate hunt to rent vs buy. Checked on the
 *  normalized query; «اجاره» also matches «اجاره‌ای». */
const RENT_WORDS = ["اجاره", "رهن"];
const BUY_WORDS = ["خرید", "فروش", "معاوضه"];

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

/** Real-estate mentions that make the transaction type (rent/buy) a
 *  required disambiguation when no transaction word is present. */
const REAL_ESTATE_WORDS = [
  "خونه",
  "خانه",
  "آپارتمان",
  "ویل",
  "زمین",
  "مغازه",
  "دفتر",
  "سوئیت",
  "پنت",
  "ملک",
  "برج",
  "کلنگی",
];

export type TransactionType = "rent" | "buy";

/** «خونه اجاره‌ای» → "rent", «آپارتمان فروشی» → "buy", else null. */
export function detectTransaction(raw: string): TransactionType | null {
  const normalized = normalizePersian(raw);
  if (RENT_WORDS.some((w) => normalized.includes(w))) return "rent";
  if (BUY_WORDS.some((w) => normalized.includes(w))) return "buy";
  return null;
}

/** True when the query talks about real estate (خونه، آپارتمان، …). */
export function mentionsRealEstate(raw: string): boolean {
  const normalized = normalizePersian(raw);
  return REAL_ESTATE_WORDS.some((w) => normalized.includes(w));
}

export type ConditionType = "new" | "used";

/**
 * «آیفون نو» → "new", «مبل کارکرده» / «گوشی دست دوم» → "used", else null.
 * Used-words are checked first: they are long and unambiguous, while «نو»
 * and «صفر» are short. Every match is word-boundary («نوع» ≠ «نو»).
 */
export function detectCondition(raw: string): ConditionType | null {
  const normalized = normalizePersian(raw);
  if (CONDITION_USED_WORDS.some((w) => includesWord(normalized, w))) return "used";
  if (CONDITION_NEW_WORDS.some((w) => includesWord(normalized, w))) return "new";
  return null;
}

/** Head-word hints for the required-dimensions engine. Explicit category
 *  picker wins; these only fire when the user never touched it. */
const VEHICLE_HINT_WORDS = [
  "ماشین", "خودرو", "وانت", "تیپ", "پراید", "پژو", "سمند", "دنا", "تیبا",
  "کوییک", "شاهین", "ساینا", "رانا", "تویوتا", "هیوندای", "نیسان", "کامیون",
];
const MOBILE_HINT_WORDS = [
  "گوشی", "موبایل", "آیفون", "سامسونگ", "شیائومی", "هواوی", "تبلت",
  "لپتاپ", "لپ‌تاپ", "کامپیوتر", "رایانه", "مانیتور", "کنسول", "هوشمند",
  "مودم", "پرینتر", "دوربین", "عکاسی", "اسپیکر", "هدفون", "هندزفری",
  "شارژر", "پاوربانک",
];
const HOME_HINT_WORDS = [
  "مبل", "مبلمان", "یخچال", "فریزر", "تلویزیون", "لباسشویی", "ظرفشویی",
  "کولر", "فرش", "قالی", "موکت", "پرده", "تخت", "تختخواب", "کمد", "دراور",
  "صندلی", "جاروبرقی", "بخارشوی", "اتو", "آباژور", "لوستر", "آینه",
];
const MUSIC_HINT_WORDS = [
  "پیانو", "گیتار", "ویولن", "سنتور", "سهتار", "دف", "تنبک", "درام",
  "ساز", "آکوستیک",
];
const PERSONAL_HINT_WORDS = [
  "مانتو", "پالتو", "بارانی", "کاپشن", "شلوار", "پیراهن", "تیشرت",
  "کفش", "کتونی", "بوت", "صندل", "کیف", "کوله", "چمدان", "عینک",
  "ساعت", "طلا", "جواهر", "انگشتر", "گردنبند", "دستبند", "عطر", "ادکلن",
  "لباس",
];

export type TextCategory =
  | "real-estate"
  | "vehicles"
  | "mobile"
  | "home"
  | "music"
  | "personal";

/**
 * Best-guess category from free text for the required-dimensions engine.
 * Real estate first (preserves the #4 transaction behavior), then goods.
 * Null when nothing matches — the engine stays silent rather than guess.
 */
export function detectCategoryFromText(raw: string): TextCategory | null {
  const normalized = normalizePersian(raw);
  const hits = (words: string[]) => words.some((w) => includesWord(normalized, w));
  if (mentionsRealEstate(raw)) return "real-estate";
  if (hits(VEHICLE_HINT_WORDS)) return "vehicles";
  if (hits(MOBILE_HINT_WORDS)) return "mobile";
  if (hits(HOME_HINT_WORDS)) return "home";
  if (hits(MUSIC_HINT_WORDS)) return "music";
  if (hits(PERSONAL_HINT_WORDS)) return "personal";
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
const UNIT = "(میلیارد|میلیون|هزار|تومان|ت)?";

function findPriceBound(normalized: string, kind: "min" | "max"): { value: number; display: string } | null {
  const patterns = kind === "max" ? MAX_PATTERNS : MIN_PATTERNS;
  for (const cue of patterns) {
    const match = normalized.match(new RegExp(`${cue}\\s+${AMOUNT}\\s*${UNIT}`));
    if (!match) continue;
    const value = parseAmount(match[1], match[2]);
    if (value === null) continue;
    const rawAmount = match[1].trim();
    const scaleUnit = match[2] === "میلیارد" || match[2] === "میلیون" || match[2] === "هزار";
    const displayAmount = scaleUnit ? `${rawAmount} ${match[2]}` : `${value.toLocaleString("fa-IR")} تومان`;
    return {
      value,
      display: kind === "max" ? `تا ${displayAmount}` : `از ${displayAmount}`,
    };
  }
  return null;
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

function addExcludeTerm(list: InterpretedConstraint[], rawTerm: string): void {
  const push = (term: string) => {
    const words = term.split(" ").filter(Boolean);
    if (term !== "" && words.length <= 3) {
      pushUnique(list, {
        id: `exclude:${term}`,
        kind: "exclude",
        value: term,
        display: term,
        source: "inferred",
        applied: true,
      });
    }
  };
  const term = normalizePersian(rawTerm);
  if (term.split(" ").filter(Boolean).length > 3 && term.includes(" و ")) {
    for (const part of term.split(" و ")) push(normalizePersian(part));
    return;
  }
  push(term);
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

  for (const city of KNOWN_CITIES) {
    if (city.names.some((name) => mentionsCity(normalized, name))) {
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

  const max = findPriceBound(normalized, "max");  if (max) {
    pushUnique(applied, {
      id: `priceMax:${max.value}`,
      kind: "priceMax",
      value: String(max.value),
      display: max.display,
      source: "inferred",
      applied: true,
    });
  }
  const min = findPriceBound(normalized, "min");
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

  for (const rawSegment of splitSegments(normalized)) {
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
        addExcludeTerm(applied, segment.slice(at + marker.length));
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
