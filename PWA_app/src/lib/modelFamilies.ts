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
}

export const MODEL_FAMILIES: readonly ModelFamily[] = Object.freeze([
  // سامسونگ. The only deliberate uniqueness exception: Galaxy
  // chocolate also exists; search is category-limited.
  { id: "galaxy", brandId: "samsung", fa: "گلکسی", en: "galaxy" },
  // اپل
  { id: "ipad", brandId: "apple", fa: "آیپد", en: "ipad" },
  { id: "macbook", brandId: "apple", fa: "مک‌بوک", en: "macbook" },
  { id: "airpods", brandId: "apple", fa: "ایرپاد", en: "airpods" },
  // شیائومی
  { id: "redmi", brandId: "xiaomi", fa: "ردمی", en: "redmi" },
  { id: "poco", brandId: "xiaomi", fa: "پوکو", en: "poco" },
  // هوآوی
  { id: "matebook", brandId: "huawei", fa: "میت‌بوک", en: "matebook" },
  // سونی
  { id: "playstation", brandId: "sony", fa: "پلی‌استیشن", en: "playstation" },
  { id: "bravia", brandId: "sony", fa: "براویا", en: "bravia" },
  { id: "xperia", brandId: "sony", fa: "اکسپریا", en: "xperia" },
  // لنوو
  { id: "thinkpad", brandId: "lenovo", fa: "تینک‌پد", en: "thinkpad" },
  { id: "ideapad", brandId: "lenovo", fa: "آیدیاپد", en: "ideapad" },
  // ایسوس
  { id: "zenbook", brandId: "asus", fa: "ذن‌بوک", en: "zenbook" },
  { id: "vivobook", brandId: "asus", fa: "ویووبوک", en: "vivobook" },
  // ایسر
  { id: "aspire", brandId: "acer", fa: "اسپایر", en: "aspire" },
  // اچ‌پی
  { id: "pavilion", brandId: "hp", fa: "پاویلیون", en: "pavilion" },
  { id: "elitebook", brandId: "hp", fa: "الیت‌بوک", en: "elitebook" },
  { id: "probook", brandId: "hp", fa: "پروبوک", en: "probook" },
  // dell
  { id: "inspiron", brandId: "dell", fa: "اینسپایرون", en: "inspiron" },
  { id: "vostro", brandId: "dell", fa: "وسترو", en: "vostro" },
  { id: "alienware", brandId: "dell", fa: "الین‌ویر", en: "alienware" },
  // مایکروسافت
  { id: "xbox", brandId: "microsoft", fa: "ایکس‌باکس", en: "xbox" },
  // کانن
  { id: "powershot", brandId: "canon", fa: "پاورشات", en: "powershot" },
  // نیکون
  { id: "coolpix", brandId: "nikon", fa: "کول‌پیکس", en: "coolpix" },
  // فوجی‌فیلم
  { id: "instax", brandId: "fujifilm", fa: "اینستکس", en: "instax" },
  // دی‌جی‌آی
  { id: "mavic", brandId: "dji", fa: "ماویک", en: "mavic" },
  { id: "avata", brandId: "dji", fa: "آواتا", en: "avata" },
  // جی‌بی‌ال
  { id: "partybox", brandId: "jbl", fa: "پارتی‌باکس", en: "partybox" },
  // انکر
  { id: "soundcore", brandId: "anker", fa: "ساندکور", en: "soundcore" },
  { id: "powercore", brandId: "anker", fa: "پاورکور", en: "powercore" },
  // کاسیو
  { id: "gshock", brandId: "casio", fa: "جی‌شاک", en: "gshock" },
  { id: "edifice", brandId: "casio", fa: "ادیفایس", en: "edifice" },
  // دلونگی
  { id: "dedica", brandId: "delonghi", fa: "ددیکا", en: "dedica" },
  { id: "magnifica", brandId: "delonghi", fa: "مگنیفیکا", en: "magnifica" },
  // سایپا
  { id: "saina", brandId: "saipa", fa: "ساینا", en: "saina" },
  // کوییک: Latin form empty by design («quick» is a common word), so
  // the id falls back to the Persian form. The id is never matched
  // against text — only fa/en forms are.
  { id: "کوییک", brandId: "saipa", fa: "کوییک", en: "" },
  // کیا
  { id: "cerato", brandId: "kia", fa: "سراتو", en: "cerato" },
  { id: "sportage", brandId: "kia", fa: "اسپورتیج", en: "sportage" },
  // هیوندای
  { id: "elantra", brandId: "hyundai", fa: "النترا", en: "elantra" },
  { id: "tucson", brandId: "hyundai", fa: "توسان", en: "tucson" },
  { id: "santafe", brandId: "hyundai", fa: "سانتافه", en: "santafe" },
  // تویوتا
  { id: "corolla", brandId: "toyota", fa: "کرولا", en: "corolla" },
  { id: "camry", brandId: "toyota", fa: "کمری", en: "camry" },
  { id: "prado", brandId: "toyota", fa: "پرادو", en: "prado" },
  // نیسان
  { id: "maxima", brandId: "nissan", fa: "ماکسیما", en: "maxima" },
  // رنو
  { id: "sandero", brandId: "renault", fa: "ساندرو", en: "sandero" },
  { id: "megane", brandId: "renault", fa: "مگان", en: "megane" },
  // چری
  { id: "tiggo", brandId: "chery", fa: "تیگو", en: "tiggo" },
  { id: "arrizo", brandId: "chery", fa: "آریزو", en: "arrizo" },
  // یاماها
  { id: "clavinova", brandId: "yamaha", fa: "کلاوینوا", en: "clavinova" },
  // سوزوکی
  { id: "vitara", brandId: "suzuki", fa: "ویتارا", en: "vitara" },
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
