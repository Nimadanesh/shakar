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
 * Seed synonym map (BIDIRECTIONAL — lookup works from any member).
 * Marked SEED: hand-written starter, grows from real hunt data in M4/M7.
 * Format: canonical → members (canonical included for convenience).
 */
const SYNONYM_GROUPS: string[][] = [
  ["آپارتمان", "واحد", "سوئیت"],
  ["ماشین", "خودرو", "اتومبیل"],
  ["موبایل", "گوشی", "تلفن همراه"],
  ["لپ تاپ", "لپتاپ", "نوت بوک"],
  ["پیانو", "کیبورد"], // musical keyboard — careful: distinct from computer keyboard by category
  ["یخچال", "فریزر"],
  ["کولر", "اسپیلت"],
  ["مبل", "کاناپه"],
  ["فرش", "قالی"],
  ["دوچرخه", "بایک"],
  ["موتور", "موتورسیکلت"],
];

const synonymIndex = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  // Stem each word inside phrases too («تلفن همراهها» → «تلفن همراه»).
  const stemmed = group.map((w) =>
    normalizeForMatch(w).split(" ").map(stemToken).join(" ")
  );
  for (const w of stemmed) synonymIndex.set(w, stemmed);
}

/**
 * Expand a query term to its synonym set (stemmed; phrases kept as phrases).
 * Unknown terms return just themselves — never invent synonyms.
 */
export function expandSynonyms(term: string): string[] {
  const key = normalizeForMatch(term).split(" ").map(stemToken).join(" ");
  return synonymIndex.get(key) ?? [key];
}

/**
 * True if the ad text contains the term OR any of its synonyms.
 * Single words match at token level; phrases match as stemmed phrases.
 */
export function textMatches(adText: string, term: string): boolean {
  const tokens = tokenize(adText);
  if (tokens.length === 0) return false;
  const tokenSet = new Set(tokens);
  const stemmedText = tokens.join(" ");
  return expandSynonyms(term).some((syn) =>
    syn.includes(" ") ? stemmedText.includes(syn) : tokenSet.has(syn)
  );
}
