/**
 * persianNormalize — Persian text normalization for MATCHING (not display).
 *
 * Why this exists (docs/output-quality.md flaw #1): keyword matching on raw
 * Persian text misses real ads. An ad typed with an Arabic keyboard
 * («موبايل» with Arabic ي) or a plural («ماشین‌ها») or a synonym («واحد»
 * for «آپارتمان») would silently miss the hunter's query — the exact
 * "missed ad" trauma. This module is the prevention.
 *
 * Design: RECALL-oriented light normalization. It deliberately over-matches
 * slightly (better a weak candidate than a missed ad); M4's ranking decides
 * the ORDER. Never use the output for display — only for matching.
 *
 * Conservative by design: no verb stemming (Persian verbs are irregular —
 * «نمیروم» → «روم» would be garbage), no تر/ترین stripping («بهتر» → «به»
 * would match a preposition). Only the safe, regular noun affixes.
 */

/** Unify Arabic-script variants to Persian, strip diacritics/tatweel. */
export function unifyChars(text: string): string {
  return (
    text
      // Arabic Yeh → Persian Yeh, Arabic Kaf → Persian Kaf, Teh Marbuta → Heh
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ة/g, "ه")
      // Alef variants → plain Alef («آپارتمان» vs «اپارتمان» is THE most
      // common Persian spelling split in ads — missing this hid the
      // majority of apartment listings; flaw #9 in docs/output-quality.md)
      .replace(/آ/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ی")
      // Arabic diacritics (fatha..sukun) + superscript alef
      .replace(/[ً-ْٰ]/g, "")
      // Tatweel (kashida)
      .replace(/ـ/g, "")
  );
}

/**
 * Normalize text for matching: unify chars, treat ZWNJ as a separator
 * (so «می‌روم» and «می روم» match the same way), drop punctuation,
 * collapse whitespace.
 */
export function normalizeForMatch(text: string): string {
  return (
    unifyChars(text)
      .replace(/‌/g, " ") // ZWNJ → space for matching
      // punctuation → space (Persian + Latin)
      .replace(/[.,،؛:!؟?()«»""''\[\]{}<>|/\\\-–—_+=*~@#$%^&`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Light stemmer for a single token — strips only safe regular noun affixes:
 * plural ها/های and the indefinite/relative ی. Recall-oriented: «ماشین‌ها» and
 * «ماشینی» both become «ماشین». Length guards prevent mangling short words
 * («علی» keeps its ی).
 */
export function stemToken(token: string): string {
  // Defensive: tokens from tokenize() never contain ZWNJ (normalization
  // already split them), but direct calls should be robust too.
  let t = token.replace(/‌/g, "");
  if (t.endsWith("های") && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith("ها") && t.length > 4) t = t.slice(0, -2);
  if (t.endsWith("ی") && t.length > 3) t = t.slice(0, -1);
  return t;
}

/** Bare affixes / particles that carry no matching meaning on their own. */
const AFFIX_ONLY = new Set(["ها", "های", "می", "نمی", "تر", "ترین", "را"]);

/** Tokenize normalized text into stemmed tokens. */
export function tokenize(text: string): string[] {
  const norm = normalizeForMatch(text);
  if (!norm) return [];
  return norm
    .split(" ")
    .map(stemToken)
    .filter((t) => t.length > 0 && !AFFIX_ONLY.has(t));
}

/**
 * Explicit concept metadata for query expansion.
 *
 * Aliases are exact-equivalent terms and are expanded only inside their
 * applicable category. "related" records useful retrieval neighbors, but
 * related concepts are NOT matching aliases: callers must never infer exact
 * identity from relatedness alone.
 */
export interface SynonymConcept {
  readonly id: string;
  readonly canonical: string;
  readonly aliases: readonly string[];
  readonly related: readonly string[];
  readonly categories: readonly string[];
}

export const SYNONYM_CONCEPTS: readonly SynonymConcept[] = [
  {
    id: "apartment",
    canonical: "آپارتمان",
    aliases: ["آپارتمان", "واحد"],
    related: ["سوئیت"],
    categories: ["real-estate"],
  },
  {
    id: "vehicle",
    canonical: "خودرو",
    aliases: ["ماشین", "خودرو", "اتومبیل"],
    related: [],
    categories: ["vehicles"],
  },
  {
    id: "mobile-phone",
    canonical: "موبایل",
    aliases: ["موبایل", "گوشی", "تلفن همراه"],
    related: [],
    categories: ["mobile"],
  },
  {
    id: "laptop",
    canonical: "لپ تاپ",
    aliases: ["لپ تاپ", "لپتاپ", "نوت بوک"],
    related: [],
    categories: ["mobile"],
  },
  {
    id: "piano",
    canonical: "پیانو",
    aliases: ["پیانو"],
    related: ["کیبورد", "پیانو دیجیتال"],
    categories: ["music", "musical-instruments", "leisure-hobbies"],
  },
  {
    id: "refrigerator",
    canonical: "یخچال",
    aliases: ["یخچال"],
    related: ["فریزر", "فریزر صندوقی"],
    categories: ["home", "home-appliances", "home-kitchen"],
  },
  {
    id: "cooler",
    canonical: "کولر",
    aliases: ["کولر"],
    related: ["اسپیلت", "اسپلیت", "کولر گازی"],
    categories: ["home", "home-appliances", "home-kitchen"],
  },
  {
    id: "sofa",
    canonical: "مبل",
    aliases: ["مبل", "کاناپه"],
    related: [],
    categories: ["home", "home-appliances", "home-kitchen"],
  },
  {
    id: "carpet",
    canonical: "فرش",
    aliases: ["فرش", "قالی"],
    related: [],
    categories: ["home", "home-appliances", "home-kitchen"],
  },
  {
    id: "bicycle",
    canonical: "دوچرخه",
    aliases: ["دوچرخه", "بایک"],
    related: [],
    categories: ["vehicles"],
  },
  {
    id: "motorcycle",
    canonical: "موتور",
    aliases: ["موتور", "موتورسیکلت"],
    related: [],
    categories: ["vehicles"],
  },
] as const;

function synonymKey(term: string): string {
  return normalizeForMatch(term).split(" ").map(stemToken).join(" ");
}

const synonymIndex = new Map<string, SynonymConcept[]>();
for (const concept of SYNONYM_CONCEPTS) {
  for (const alias of concept.aliases) {
    const key = synonymKey(alias);
    const concepts = synonymIndex.get(key) ?? [];
    concepts.push(concept);
    synonymIndex.set(key, concepts);
  }
}

function conceptAppliesToCategory(concept: SynonymConcept, category?: string): boolean {
  // "all" is deliberately ambiguous. Do not use category-scoped expansion
  // until the query has a reliable category context.
  if (!category || category === "" || category === "all") return false;
  return concept.categories.includes(category);
}

/**
 * Expand a term to exact aliases of the same concept in the given category.
 * Related concepts are intentionally not included (e.g. suite/apartment,
 * keyboard/piano, freezer/refrigerator, split AC/cooler).
 *
 * Without reliable category context, use only the original normalized term.
 */
export function expandSynonyms(term: string, category?: string): string[] {
  const key = synonymKey(term);
  const concepts = (synonymIndex.get(key) ?? []).filter((concept) =>
    conceptAppliesToCategory(concept, category)
  );
  if (concepts.length === 0) return [key];
  return [...new Set(concepts.flatMap((concept) => concept.aliases.map(synonymKey)))];
}

/**
 * True if the ad text contains the term or an exact alias applicable to the
 * supplied category. Related concepts do not count as exact evidence.
 */
export function textMatches(adText: string, term: string, category?: string): boolean {
  const tokens = tokenize(adText);
  if (tokens.length === 0) return false;
  const tokenSet = new Set(tokens);
  const stemmedText = tokens.join(" ");
  return expandSynonyms(term, category).some((syn) =>
    syn.includes(" ") ? stemmedText.includes(syn) : tokenSet.has(syn)
  );
}
