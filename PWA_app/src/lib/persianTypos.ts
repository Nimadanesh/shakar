/**
 * persianTypos.ts — typo tolerance for Persian hunt keywords.
 *
 * Persian typos are frequent (mobile keyboards, Arabic/Persian layout
 * switching) and a misspelled required keyword silently kills a hunt:
 * Divar retrieval is literal, so «نورکیر» never matches «نورگیر» ads.
 *
 * Strategy (all client-side, zero quota cost):
 *  1. `suggestTypoFix(word)` — keyboard-aware single-edit suggestions
 *     against a compact lexicon of common Persian words. Only fires when
 *     the typed word is NOT a known word but a 1-edit neighbor IS.
 *  2. The hunt form shows a one-tap «منظورت X بود؟» nudge (pre-search).
 *  3. The M3 decision-model prompt gets a typo-tolerance instruction
 *     (free — same per-search call) as the safety net.
 *
 * Deliberate limits: suggestions are conservative (dismissible nudge, never
 * auto-replace); words with digits/latin (model numbers like «U3», «206»),
 * short words (<3 chars) and known words never trigger.
 */

/** ISIRI-2901 Persian keyboard adjacency (including diagonals). */
const ADJACENCY: Record<string, readonly string[]> = {
  "ض": ["ص", "ش", "س"],
  "ص": ["ض", "ث", "ش", "س", "ی"],
  "ث": ["ص", "ق", "س", "ی", "ب"],
  "ق": ["ث", "ف", "ی", "ب", "ل"],
  "ف": ["ق", "غ", "ب", "ل", "ا"],
  "غ": ["ف", "ع", "ل", "ا", "ت"],
  "ع": ["غ", "ه", "ا", "ت", "ن"],
  "ه": ["ع", "خ", "ت", "ن", "م"],
  "خ": ["ه", "ح", "ن", "م", "ک"],
  "ح": ["خ", "ج", "م", "ک", "گ"],
  "ج": ["ح", "چ", "ک", "گ"],
  "چ": ["ج", "گ"],
  "ش": ["ض", "ص", "س"],
  "س": ["ش", "ص", "ث", "ی"],
  "ی": ["س", "ث", "ق", "ب"],
  "ب": ["ی", "ث", "ق", "ف", "ل"],
  "ل": ["ب", "ق", "ف", "غ", "ا"],
  "ا": ["ل", "ف", "غ", "ع", "ت"],
  "ت": ["ا", "غ", "ع", "ه", "ن"],
  "ن": ["ت", "ع", "ه", "خ", "م"],
  "م": ["ن", "ه", "خ", "ح", "ک"],
  "ک": ["م", "خ", "ح", "ج", "گ"],
  "گ": ["ک", "ح", "ج", "چ"],
  "ظ": ["ط", "ش", "س"],
  "ط": ["ظ", "ز", "ش", "س", "ی"],
  "ز": ["ط", "ر", "س", "ی", "ب"],
  "ر": ["ز", "ذ", "ی", "ب", "ل"],
  "ذ": ["ر", "د", "ب", "ل", "ا"],
  "د": ["ذ", "پ", "ل", "ا", "ت"],
  "پ": ["د", "و", "ا", "ت", "ن"],
  "و": ["پ", "ت", "ن"],
};

export function keyboardNeighbors(ch: string): readonly string[] {
  return ADJACENCY[ch] ?? [];
}

const PERSIAN_LETTERS = Object.keys(ADJACENCY);

/**
 * Compact lexicon of common Persian words (normalized: Persian ی/ک,
 * no ZWNJ, no digits). Covers everyday vocabulary + Divar-heavy domains
 * (real estate, cars, phones, home goods). The suggestion engine only
 * proposes words from this list, so its quality == this list's coverage.
 */
const LEXICON_WORDS: readonly string[] = [
  // ——— مسکن و ملک ———
  "خانه", "خونه", "آپارتمان", "ویلا", "باغ", "باغچه", "زمین", "مغازه", "دفتر",
  "انبار", "سوله", "نورگیر", "پارکینگ", "انباری", "آسانسور", "تراس", "بالکن",
  "ایوان", "حیاط", "پاسیو", "نوساز", "بازسازی", "کلنگی", "سنددار", "سند",
  "قولنامه", "رهن", "اجاره", "خرید", "فروش", "پیشفروش", "معاوضه", "مشارکت",
  "طبقه", "واحد", "متراژ", "متری", "خوابه", "خواب", "آشپزخانه", "سرویس",
  "حمام", "استخر", "سونا", "جکوزی", "لابی", "نگهبان", "سرایدار", "شهرک",
  "برج", "پنتهاوس", "سوئیت", "زیرزمین", "همکف", "دوبلکس", "تریبلکس",
  "شمالی", "جنوبی", "شرقی", "غربی", "نبش", "کوچه", "خیابان", "بلوار", "میدان",
  // ——— خودرو ———
  "ماشین", "خودرو", "سواری", "وانت", "کامیون", "موتور", "موتورسیکلت", "دوچرخه",
  "پراید", "پژو", "سمند", "دنا", "تیبا", "کوییک", "شاهین", "ساینا", "رانا",
  "تویوتا", "هیوندای", "کیا", "نیسان", "صفر", "کارکرده", "دستدوم", "دندهای",
  "اتومات", "اتوماتیک", "بیمه", "لاستیک", "گیربکس", "بدنه", "رنگ", "صافکاری",
  // ——— موبایل و دیجیتال ———
  "گوشی", "موبایل", "تلفن", "آیفون", "سامسونگ", "شیائومی", "هواوی", "نوکیا",
  "تبلت", "لپتاپ", "کامپیوتر", "رایانه", "مانیتور", "کیبورد", "هدفون",
  "هندزفری", "اسپیکر", "بلندگو", "ساعت", "هوشمند", "دوربین", "لنز", "عکاسی",
  "کنسول", "دسته", "شارژر", "کابل", "قاب", "گلس", "پاوربانک", "مودم",
  // ——— لوازم خانگی ———
  "مبل", "مبلمان", "کاناپه", "یخچال", "فریزر", "تلویزیون", "ماشینلباسشویی",
  "ظرفشویی", "لباسشویی", "کولر", "کولرگازی", "بخاری", "شوفاژ", "پکیج",
  "آبگرمکن", "اجاق", "گاز", "فر", "مایکروفر", "جاروبرقی", "بخارشوی", "اتو",
  "چرخخیاطی", "تخت", "تختخواب", "سرویسخواب", "کمد", "دراور", "میز", "صندلی",
  "فرش", "قالی", "قالیچه", "موکت", "پرده", "لوستر", "آباژور", "آینه",
  "قابلمه", "ماهیتابه", "سرویسقابلمه", "چایساز", "قهوهساز",
  // ——— مد و زیبایی ———
  "لباس", "مانتو", "پالتو", "بارانی", "کاپشن", "شلوار", "پیراهن", "تیشرت",
  "کفش", "کتونی", "بوت", "صندل", "کیف", "کولهپشتی", "چمدان", "عینک",
  "عینکآفتابی", "ساعتمچی", "طلا", "جواهر", "انگشتر", "گردنبند", "دستبند",
  "گوشواره", "نقره", "عطر", "ادکلن",
  // ——— کودک ———
  "کالسکه", "تختنوزاد", "لباسنوزادی", "اسباببازی",
  // ——— ورزش ———
  "دمبل", "تردمیل", "میزپینگپنگ",
  // ——— آلات موسیقی ———
  "پیانو", "گیتار", "ویولن", "سنتور", "تار", "سهتار", "دف", "تنبک", "آکوستیک",
  "دیجیتال",
  // ——— وضعیت و صفات ———
  "نو", "آکبند", "اصل", "اورجینال", "تمیز", "سالم", "دستنخورده", "استوک",
  "تعمیری", "خراب", "شکسته", "خطوخش", "فوری", "توافقی", "مقطوع", "زیرقیمت",
  "حراج", "تخفیف", "قسطی", "نقدی", "شیک", "مدرن", "کلاسیک", "چوبی", "فلزی",
  "پلاستیکی", "برقی", "گازی", "بزرگ", "کوچک", "متوسط", "بلند", "کوتاه",
  "سنگین", "سبک", "سفید", "مشکی", "قرمز", "آبی", "سبز", "زرد", "خاکستری",
  "قهوهای", "کرم", "سرمهای", "طلایی", "نقرهای",
  // ——— افعال و کلمات رایج ———
  "کردن", "شدن", "بودن", "داشتن", "گرفتن", "دادن", "رفتن", "آمدن", "دیدن",
  "خریدن", "فروختن", "میخوام", "میخواهم", "نمیخوام", "هست", "نیست", "دارد",
  "ندارد", "برای", "بدون", "همراه", "فقط",
  // ——— شهرها ———
  "تهران", "کرج", "اصفهان", "شیراز", "مشهد", "تبریز", "قم", "اهواز", "رشت",
  "کرمان", "یزد", "کیش",
  // ——— واحدها ———
  "تومان", "ریال", "دلار", "میلیون", "میلیارد", "هزار", "متر", "سانتیمتر",
  "کیلو", "لیتر",
];

const LEXICON = new Set<string>(LEXICON_WORDS);

/** Lookup form: strip ZWNJ (lexicon stores ZWNJ-free words). */
function lookupForm(word: string): string {
  return word.replace(/‌/g, "");
}

function firstHit(candidates: Iterable<string>): string | null {
  for (const c of candidates) {
    if (LEXICON.has(c)) return c;
  }
  return null;
}

function* keyboardSubstitutions(word: string): Generator<string> {
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    for (const n of keyboardNeighbors(chars[i])) {
      const v = [...chars];
      v[i] = n;
      yield v.join("");
    }
  }
}

function* transpositions(word: string): Generator<string> {
  const chars = [...word];
  for (let i = 0; i < chars.length - 1; i++) {
    const v = [...chars];
    [v[i], v[i + 1]] = [v[i + 1], v[i]];
    yield v.join("");
  }
}

function* deletions(word: string): Generator<string> {
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const v = [...chars];
    v.splice(i, 1);
    yield v.join("");
  }
}

function* insertions(word: string): Generator<string> {
  const chars = [...word];
  for (let i = 0; i <= chars.length; i++) {
    for (const ch of PERSIAN_LETTERS) {
      const v = [...chars];
      v.splice(i, 0, ch);
      yield v.join("");
    }
  }
}

/**
 * Suggest a correction for a possibly-misspelled Persian word.
 * Returns the suggested word, or null when the word looks fine
 * (known word, too short, or contains digits/latin like model numbers).
 * Ranked: keyboard-adjacent substitution > transposition > deletion > insertion.
 */
export function suggestTypoFix(raw: string): string | null {
  const word = lookupForm(raw);
  if (word.length < 3) return null;
  if (/[a-zA-Z0-9۰-۹٠-٩]/.test(word)) return null;
  if (LEXICON.has(word)) return null;
  return (
    firstHit(keyboardSubstitutions(word)) ??
    firstHit(transpositions(word)) ??
    firstHit(deletions(word)) ??
    firstHit(insertions(word)) ??
    null
  );
}

/** True when the word is a known word (or skipped class) — no nudge needed. */
export function isKnownWord(raw: string): boolean {
  const word = lookupForm(raw);
  if (word.length < 3) return true;
  if (/[a-zA-Z0-9۰-۹٠-٩]/.test(word)) return true;
  return LEXICON.has(word);
}
