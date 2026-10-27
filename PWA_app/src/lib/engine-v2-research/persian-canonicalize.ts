/**
 * Deterministic Persian matching canonicalizer for engine_v2_research.
 * It does not perform stemming, synonym expansion, transliteration, or brand
 * alias inference. Keep the untouched input alongside the matching form.
 */

export interface CanonicalizedText {
  readonly original: string;
  readonly canonical: string;
  readonly tokens: readonly string[];
}

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const PUNCTUATION = /[.,،؛:!؟?()«»"“”'‘’\[\]{}<>|\/\\\-–—_+=*~@#$%^&\x60؛،。؛：！？，]/g;
const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
const PROTECTED_SUFFIX_WORDS = new Set(["تنها", "بهتر", "بهترین", "بیشتر", "کمتر"]);
const SUFFIXES = ["ترین", "های", "ها", "تر"] as const;

function baseCanonicalize(input: string): string {
  return input
    // C1: Alef variants -> plain Alef.
    .replace(/[آأإٱ]/g, "ا")
    // C2: Arabic Yeh/Kaf and Teh Marbuta.
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    // C3: ZWNJ is a separator for matching; original is retained by caller.
    .replace(/[\u200c\u200d]/g, " ")
    // C4: diacritics and tatweel.
    .replace(DIACRITICS, "")
    .replace(/ـ/g, "")
    // C5: Persian and Arabic digits -> ASCII digits.
    .replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit] ?? digit)
    // C6: punctuation is a token boundary, then collapse whitespace.
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim()
    // C7: Latin lowercase.
    .toLowerCase();
}

function letterCount(value: string): number {
  return [...value].filter((char) => /[\p{L}]/u.test(char)).length;
}

/**
 * C9 closed-morpheme layer. Corpus tokens must be independently observed
 * surface tokens (not generated aliases). No suffix is stripped unless the
 * remainder itself exists as a token in that supplied corpus.
 */
export function stripClosedMorpheme(token: string, corpusTokens: ReadonlySet<string>): string {
  if (PROTECTED_SUFFIX_WORDS.has(token)) return token;
  for (const suffix of SUFFIXES) {
    if (!token.endsWith(suffix)) continue;
    const remainder = token.slice(0, -suffix.length);
    if (letterCount(remainder) < 3) continue;
    if (!corpusTokens.has(remainder)) continue;
    // The standalone final ی suffix is intentionally absent from SUFFIXES.
    return remainder;
  }
  return token;
}

export function canonicalizeForMatch(
  input: string,
  options: { readonly corpusTokens?: ReadonlySet<string> } = {},
): CanonicalizedText {
  const canonical = baseCanonicalize(input);
  const corpusTokens = options.corpusTokens ?? new Set<string>();
  const tokens = canonical
    ? canonical.split(" ").map((token) => stripClosedMorpheme(token, corpusTokens))
    : [];
  return { original: input, canonical: tokens.join(" "), tokens };
}

/** Reports any two distinct observed words that collapse to one canonical form. */
export function findCanonicalCollisions(words: readonly string[]): Array<{
  canonical: string;
  originals: string[];
}> {
  // The audit corpus is the observed surface-token set. A C9 remainder is
  // eligible only when that exact base token independently occurs in it.
  const observedTokens = new Set<string>();
  const baseByWord = new Map<string, string>();
  for (const original of words) {
    const base = baseCanonicalize(original);
    baseByWord.set(original, base);
    for (const token of base.split(" ").filter(Boolean)) observedTokens.add(token);
  }

  const byCanonical = new Map<string, Set<string>>();
  for (const original of words) {
    const base = baseByWord.get(original) ?? "";
    const canonical = base
      .split(" ")
      .filter(Boolean)
      .map((token) => stripClosedMorpheme(token, observedTokens))
      .join(" ");
    if (!canonical) continue;
    const originals = byCanonical.get(canonical) ?? new Set<string>();
    originals.add(original);
    byCanonical.set(canonical, originals);
  }
  return [...byCanonical.entries()]
    .filter(([, originals]) => originals.size > 1)
    .map(([canonical, originals]) => ({ canonical, originals: [...originals].sort() }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical, "fa"));
}

export const CANONICALIZATION_RULES = [
  "C1 Alef variants -> ا",
  "C2 Arabic ي/ى -> ی, ك -> ک, ة -> ه",
  "C3 ZWNJ/ZWJ -> space for matching; original preserved",
  "C4 remove Arabic diacritics and tatweel",
  "C5 Persian/Arabic digits -> ASCII",
  "C6 punctuation -> token boundary; collapse repeated whitespace",
  "C7 lowercase Latin",
  "C8 no stemming, synonym merging, or guessed brand aliases",
  "C9 strip only ها/های/تر/ترین with minimum-length, corpus, and protection guards; never strip standalone ی",
] as const;
