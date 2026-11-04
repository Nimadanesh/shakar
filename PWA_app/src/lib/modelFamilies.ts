/**
 * HANDOFF-4b — model families: the closed «brand ← family» map.
 *
 * A title that carries only a model-family name («Mavic», «گلکسی»)
 * counts, for a query that carries the owning brand, like a title
 * carrying the brand name. Matching is exact only — no prefix, no
 * substring, no fuzzy — and the gates stay above this map.
 *
 * «دانش عمومی بازار ایران؛ نه از تیترهای مجموعه‌های طلایی یا بیرونی.
 * قفل تا پایان داوری مجموعه ۲.»
 *
 * This file is pure data (like brandAliases.ts) and imports nothing,
 * so persianNormalize can import it without a cycle.
 *
 * Deleted from the handoff list (owner amendments, deletion only):
 * - «هوندا | سیویک | civic»: Honda is an N group, not a brandAliases
 *   group, and brandAliases must not change.
 * - «ایران‌خودرو | رانا | rana»: «رانا» is also a person's name.
 * Final list: 51 entries, 28 brands.
 */

export interface ModelFamily {
  /** Standard Latin key (the Latin form); for کوییک, whose Latin form
   * is empty by design («quick» is a common word), the Persian form. */
  readonly id: string;
  /** Group id in brandAliases.ts. */
  readonly brandId: string;
  /** Persian form (one form only; e.g. «ماویک», never «مویک»). */
  readonly fa: string;
  /** Latin form, or "" when the handoff leaves it empty. */
  readonly en: string;
  /**
   * HANDOFF-4c1 table 1: the family's default fine kind. Absent for
   * multi-kind families (galaxy, redmi, poco, soundcore) — their kind
   * comes only from table 2's next word, if any.
   */
  readonly kind?: FamilyKind;
}

/** HANDOFF-4c1: the closed fine-kind vocabulary (table 1/2/3). */
export type FamilyKind =
  | "phone"
  | "tablet"
  | "laptop"
  | "watch"
  | "headphones"
  | "speaker"
  | "powerbank"
  | "console"
  | "tv"
  | "camera"
  | "drone"
  | "coffee-machine"
  | "car"
  | "piano"
  | "motorcycle";

export const MODEL_FAMILIES: readonly ModelFamily[] = Object.freeze([
  // سامسونگ. The only deliberate uniqueness exception: Galaxy
  // chocolate also exists; search is category-limited.
  { id: "galaxy", brandId: "samsung", fa: "گلکسی", en: "galaxy" },
  // اپل
  { id: "ipad", brandId: "apple", fa: "آیپد", en: "ipad", kind: "tablet" },
  { id: "macbook", brandId: "apple", fa: "مک‌بوک", en: "macbook", kind: "laptop" },
  { id: "airpods", brandId: "apple", fa: "ایرپاد", en: "airpods", kind: "headphones" },
  // شیائومی
  { id: "redmi", brandId: "xiaomi", fa: "ردمی", en: "redmi" },
  { id: "poco", brandId: "xiaomi", fa: "پوکو", en: "poco" },
  // هوآوی
  { id: "matebook", brandId: "huawei", fa: "میت‌بوک", en: "matebook", kind: "laptop" },
  // سونی
  { id: "playstation", brandId: "sony", fa: "پلی‌استیشن", en: "playstation", kind: "console" },
  { id: "bravia", brandId: "sony", fa: "براویا", en: "bravia", kind: "tv" },
  { id: "xperia", brandId: "sony", fa: "اکسپریا", en: "xperia", kind: "phone" },
  // لنوو
  { id: "thinkpad", brandId: "lenovo", fa: "تینک‌پد", en: "thinkpad", kind: "laptop" },
  { id: "ideapad", brandId: "lenovo", fa: "آیدیاپد", en: "ideapad", kind: "laptop" },
  // ایسوس
  { id: "zenbook", brandId: "asus", fa: "ذن‌بوک", en: "zenbook", kind: "laptop" },
  { id: "vivobook", brandId: "asus", fa: "ویووبوک", en: "vivobook", kind: "laptop" },
  // ایسر
  { id: "aspire", brandId: "acer", fa: "اسپایر", en: "aspire", kind: "laptop" },
  // اچ‌پی
  { id: "pavilion", brandId: "hp", fa: "پاویلیون", en: "pavilion", kind: "laptop" },
  { id: "elitebook", brandId: "hp", fa: "الیت‌بوک", en: "elitebook", kind: "laptop" },
  { id: "probook", brandId: "hp", fa: "پروبوک", en: "probook", kind: "laptop" },
  // dell
  { id: "inspiron", brandId: "dell", fa: "اینسپایرون", en: "inspiron", kind: "laptop" },
  { id: "vostro", brandId: "dell", fa: "وسترو", en: "vostro", kind: "laptop" },
  { id: "alienware", brandId: "dell", fa: "الین‌ویر", en: "alienware", kind: "laptop" },
  // مایکروسافت
  { id: "xbox", brandId: "microsoft", fa: "ایکس‌باکس", en: "xbox", kind: "console" },
  // کانن
  { id: "powershot", brandId: "canon", fa: "پاورشات", en: "powershot", kind: "camera" },
  // نیکون
  { id: "coolpix", brandId: "nikon", fa: "کول‌پیکس", en: "coolpix", kind: "camera" },
  // فوجی‌فیلم
  { id: "instax", brandId: "fujifilm", fa: "اینستکس", en: "instax", kind: "camera" },
  // دی‌جی‌آی
  { id: "mavic", brandId: "dji", fa: "ماویک", en: "mavic", kind: "drone" },
  { id: "avata", brandId: "dji", fa: "آواتا", en: "avata", kind: "drone" },
  // جی‌بی‌ال
  { id: "partybox", brandId: "jbl", fa: "پارتی‌باکس", en: "partybox", kind: "speaker" },
  // انکر
  { id: "soundcore", brandId: "anker", fa: "ساندکور", en: "soundcore" },
  { id: "powercore", brandId: "anker", fa: "پاورکور", en: "powercore", kind: "powerbank" },
  // کاسیو
  { id: "gshock", brandId: "casio", fa: "جی‌شاک", en: "gshock", kind: "watch" },
  { id: "edifice", brandId: "casio", fa: "ادیفایس", en: "edifice", kind: "watch" },
  // دلونگی
  { id: "dedica", brandId: "delonghi", fa: "ددیکا", en: "dedica", kind: "coffee-machine" },
  { id: "magnifica", brandId: "delonghi", fa: "مگنیفیکا", en: "magnifica", kind: "coffee-machine" },
  // سایپا
  { id: "saina", brandId: "saipa", fa: "ساینا", en: "saina", kind: "car" },
  // کوییک: Latin form empty by design («quick» is a common word), so
  // the id falls back to the Persian form. The id is never matched
  // against text — only fa/en forms are.
  { id: "کوییک", brandId: "saipa", fa: "کوییک", en: "", kind: "car" },
  // کیا
  { id: "cerato", brandId: "kia", fa: "سراتو", en: "cerato", kind: "car" },
  { id: "sportage", brandId: "kia", fa: "اسپورتیج", en: "sportage", kind: "car" },
  // هیوندای
  { id: "elantra", brandId: "hyundai", fa: "النترا", en: "elantra", kind: "car" },
  { id: "tucson", brandId: "hyundai", fa: "توسان", en: "tucson", kind: "car" },
  { id: "santafe", brandId: "hyundai", fa: "سانتافه", en: "santafe", kind: "car" },
  // تویوتا
  { id: "corolla", brandId: "toyota", fa: "کرولا", en: "corolla", kind: "car" },
  { id: "camry", brandId: "toyota", fa: "کمری", en: "camry", kind: "car" },
  { id: "prado", brandId: "toyota", fa: "پرادو", en: "prado", kind: "car" },
  // نیسان
  { id: "maxima", brandId: "nissan", fa: "ماکسیما", en: "maxima", kind: "car" },
  // رنو
  { id: "sandero", brandId: "renault", fa: "ساندرو", en: "sandero", kind: "car" },
  { id: "megane", brandId: "renault", fa: "مگان", en: "megane", kind: "car" },
  // چری
  { id: "tiggo", brandId: "chery", fa: "تیگو", en: "tiggo", kind: "car" },
  { id: "arrizo", brandId: "chery", fa: "آریزو", en: "arrizo", kind: "car" },
  // یاماها
  { id: "clavinova", brandId: "yamaha", fa: "کلاوینوا", en: "clavinova", kind: "piano" },
  // سوزوکی
  { id: "vitara", brandId: "suzuki", fa: "ویتارا", en: "vitara", kind: "car" },
]);

/**
 * HANDOFF-4c1 tables 2 and 3.
 *
 * «دانش عمومی بازار؛ نه از تیترهای مجموعه‌های طلایی یا بیرونی.
 * قفل تا پایان داوری مجموعه ۲.»
 *
 * Table 2 (next word) overrides table 1's default kind for every
 * family: the first token after the last token of the family name in
 * the title, compared exactly after normalization (Latin
 * case-insensitive). Table 3 (fine kind) maps kind words both for the
 * query subject and for the title head; matching is spaceless, exact,
 * longest window first (like HANDOFF-2ج), so «لپ‌تاپ» also covers
 * «لپتاپ» / «لپ تاپ» through the same spaceless key. Deliberately
 * absent (ambiguous, never a kind): ماشین، موتور، کامپیوتر، نوت‌بوک،
 * ارگ، ایرپاد، هدست — «نوت‌بوک» is NOT a laptop form.
 */
export const FAMILY_NEXT_WORD_KIND: Readonly<Record<string, FamilyKind>> =
  Object.freeze({
    tab: "tablet",
    تب: "tablet",
    pad: "tablet",
    پد: "tablet",
    tablet: "tablet",
    تبلت: "tablet",
    watch: "watch",
    واچ: "watch",
    ساعت: "watch",
    buds: "headphones",
    بادز: "headphones",
    book: "laptop",
    بوک: "laptop",
  });

export const FINE_KIND_WORDS: readonly {
  readonly kind: FamilyKind;
  readonly forms: readonly string[];
}[] = Object.freeze([
  { kind: "phone", forms: ["گوشی", "موبایل", "تلفن همراه"] },
  { kind: "tablet", forms: ["تبلت"] },
  { kind: "laptop", forms: ["لپ‌تاپ"] },
  { kind: "watch", forms: ["ساعت", "ساعت هوشمند"] },
  { kind: "headphones", forms: ["هدفون", "هندزفری"] },
  { kind: "speaker", forms: ["اسپیکر", "بلندگو"] },
  { kind: "powerbank", forms: ["پاوربانک"] },
  { kind: "console", forms: ["کنسول"] },
  { kind: "tv", forms: ["تلویزیون"] },
  { kind: "camera", forms: ["دوربین"] },
  { kind: "drone", forms: ["پهپاد"] },
  { kind: "coffee-machine", forms: ["قهوه‌ساز", "اسپرسوساز"] },
  { kind: "car", forms: ["خودرو", "اتومبیل", "سواری"] },
  { kind: "motorcycle", forms: ["موتورسیکلت"] },
  { kind: "piano", forms: ["پیانو"] },
]);

/**
 * The key shape familyByToken compares: lowercase, spaces and ZWNJ
 * removed, Arabic letters folded to Persian (the same letter fold
 * unifyChars applies). This mirrors the engine's brandKey shape so a
 * token and a list form meet on the same key; the engine itself keys
 * through persianNormalize's brandKey.
 */
function familyTokenKey(token: string): string {
  return token
    .toLowerCase()
    .replace(/[()«»""''\[\]{}<>|/\\\-\–—_+=*~@#$%^&`,؛.،!؟:]/g, "")
    .replace(/[\s\u200C]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "ا")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ط/g, "ت")
    .replace(/ئ/g, "ی")
    .replace(/ة/g, "ه")
    .replace(/ۀ/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "");
}

const FAMILY_BY_KEY: ReadonlyMap<string, ModelFamily> = (() => {
  const map = new Map<string, ModelFamily>();
  for (const family of MODEL_FAMILIES) {
    for (const form of [family.fa, family.en]) {
      if (form === "") continue;
      const key = familyTokenKey(form);
      if (key !== "" && !map.has(key)) map.set(key, family);
    }
  }
  return map;
})();

const FAMILY_BY_ID: ReadonlyMap<string, ModelFamily> = new Map(
  MODEL_FAMILIES.map((family) => [family.id, family])
);

const FAMILIES_BY_BRAND: ReadonlyMap<string, readonly ModelFamily[]> =
  (() => {
    const map = new Map<string, ModelFamily[]>();
    for (const family of MODEL_FAMILIES) {
      const list = map.get(family.brandId) ?? [];
      list.push(family);
      map.set(family.brandId, list);
    }
    return map;
  })();

/** The family of a single token (either form), or undefined. */
export function familyByToken(token: string): ModelFamily | undefined {
  return FAMILY_BY_KEY.get(familyTokenKey(token));
}

/** The owning brand id of a family id, or undefined. */
export function brandOfFamily(id: string): string | undefined {
  return FAMILY_BY_ID.get(id)?.brandId;
}

/** All families of a brand id (empty when the brand has none). */
export function familiesOfBrand(brandId: string): readonly ModelFamily[] {
  return FAMILIES_BY_BRAND.get(brandId) ?? [];
}
