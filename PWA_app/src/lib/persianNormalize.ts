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
      // HANDOFF-2 (2026-11-02) layer A1: the remaining Arabic-script
      // variants — Alef Maksura → Yeh, Alef-with-Hamza / Alef Wasla →
      // plain Alef, Heh-with-Yeh-above → Heh. Only ADDS unifications;
      // no previously-matching form stops matching.
      .replace(/ى/g, "ی")
      .replace(/أ/g, "ا")
      .replace(/إ/g, "ا")
      .replace(/ٱ/g, "ا")
      .replace(/ۀ/g, "ه")
      // Alef variants → plain Alef («آپارتمان» vs «اپارتمان» is THE most
      // common Persian spelling split in ads — missing this hid the
      // majority of apartment listings; flaw #9 in docs/output-quality.md)
      .replace(/آ/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ی")
      // R8 (2026-10-19, red-team F1): ط/ت are the same phoneme and the wild
      // mixes them freely («باطری»/«باتری» — verified: the marker guard
      // compared surface tokens and a BATTERY ad was rejected from a
      // BATTERY hunt). Folded HERE at the choke point so every membership
      // test (textMatches, marker guards, kind lexicon) heals at once —
      // never patched per-callsite.
      // DELIBERATELY NOT folded: ا/و (بادام/بادوم — distinct phonemes; the
      // peanut family has dedicated machinery), س/ص، ز/ذ/ض/ظ، ح/ه، ع/ا، غ/ق
      // (no verified wound; each needs its own collision audit).
      .replace(/ط/g, "ت")
      // Arabic diacritics (fatha..sukun) + superscript alef + hamza
      // above (U+0654, e.g. «مدرسهٔ» — HANDOFF-2ب §3: without it the
      // hamza-bearing head never equals the service word «مدرسه» and
      // the G1 gate misses). Superscript alef U+0670 was already in
      // this class (probe-verified); only U+0654 is new here.
      .replace(/[ً-ْٰٔ]/g, "")
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
      // Script-boundary guard: real classifieds concatenate Persian item names
      // with Latin model codes («پیانوC1», «یاماهاP-145»). Separate the
      // scripts before tokenization so the Persian MUST term is not lost.
      .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, "$1 $2")
      .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1 $2")
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

/** Bare affixes / particles that carry no matching meaning on their own. Exported: the query resolver's surface-term filter uses the same set so a stray «می» can never become a MUST term (R3 2026-10-17). */
export const AFFIX_ONLY = new Set(["ها", "های", "می", "نمی", "تر", "ترین", "را"]);

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
 * HANDOFF-N (2026-11-02, re-run 2026-11-02 with the narrowed breaking
 * rule): closed-list matching equivalence. Every group is bidirectional
 * and comes only from GOLDEN-REPORT-3 titles and the 16 sentences —
 * no group outside these lists exists here.
 *
 * Spelling groups (both paths) and synonym/suffix groups (include path
 * only) are applied by canonicalizing tokens, never by editing the
 * stored definition. Map keys are in folded form (آ→ا) because term
 * keys arrive folded; replacements pass through stemToken so they meet
 * folded term keys.
 */
// Single-token substitutions, keyed by the variant.
const SPELLING_SINGLE_MAP: Record<string, string> = {
  // 1. هوندا
  هندا: "هوندا",
  honda: "هوندا",
  // 2. نینتندو
  نیتندو: "نینتندو",
  nintendo: "نینتندو",
  // 3. سوییچ
  سویچ: "سوییچ",
  switch: "سوییچ",
  // 4. آیفون (folded form)
  iphone: "ایفون",
  // 7. ری‌بن (spaced/glued forms reach here via the split map)
  ray: "ری",
  ban: "بن",
};
// Glued-token substitutions: one token becomes two.
const SPELLING_SPLIT_MAP: Record<string, string[]> = {
  // 5. پرومکس
  پرومکس: ["پرو", "مکس"],
  promax: ["پرو", "مکس"],
  // 7. ریبن
  ریبن: ["ری", "بن"],
  rayban: ["ری", "بن"],
  // 10. لپتاپ
  لپتاپ: ["لپ", "تاپ"],
  // 6. دناپلاس
  دناپلاس: ["دنا", "پلاس"],
  // 15. تخت خواب
  تختخواب: ["تخت", "خواب"],
  // 8. دونفره
  دونفره: ["دو", "نفره"],
  // 16. دوخوابه
  دوخوابه: ["دو", "خوابه"],
  // 9. دست دوم (glued, no ZWNJ/space)
  دستدوم: ["دست", "دوم"],
  // 16. 2خوابه (Latin digit glued; Persian-digit form splits via breaking)
  "2خوابه": ["2", "خوابه"],
};
// Adjacent-pair substitutions, keyed with a plain space (spelling family).
const SPELLING_PAIR_MAP: Record<string, string[]> = {
  // 16. دو خواب / ۲ خوابه / 2 خوابه all read as دو خوابه.
  "دو خواب": ["دو", "خوابه"],
  "۲ خوابه": ["دو", "خوابه"],
  "2 خوابه": ["دو", "خوابه"],
  // 5. pro max (spaced Latin form)
  "pro max": ["پرو", "مکس"],
};
// Adjacent-pair substitutions (include family only).
const INCLUDE_PAIR_MAP: Record<string, string[]> = {
  // 19. عینک دودی reads as عینک آفتابی. Both the raw ی-form and the
  // stemmed ی-less form map to the stemmed replacement, so raw and
  // stemmed term keys both match stemmed ad tokens. The replacement is
  // in folded form (آ→ا) so it meets folded term keys.
  "عینک دودی": ["عینک", "افتابی"],
  "عینک دود": ["عینک", "افتابی"],
  // 22. سرویس خواب reads as تخت خواب.
  "سرویس خواب": ["تخت", "خواب"],
  // 21. آسانسور دار (spaced form) reads as آسانسور (folded form).
  "اسانسور دار": ["اسانسور"],
};
// Single-token substitutions (include family only).
const INCLUDE_SINGLE_MAP: Record<string, string> = {
  // 17. اتوماتیک reads as اتومات.
  اتوماتیک: "اتومات",
  // 18. اورجینال reads as اصل.
  اورجینال: "اصل",
  // 20. ویلایی / ویلای read as ویلا (both stemmed and unstemmed forms).
  ویلایی: "ویلا",
  ویلای: "ویلا",
  // 21. آسانسوردار (glued form) reads as آسانسور (folded form).
  اسانسوردار: "اسانسور",
};

/**
 * Letter runs whose letter–digit boundary may split even without Persian
 * script: the Latin members of the spelling groups. Anything else glued
 * to a digit (model codes like «U3», «C1», «ADV160») is left whole —
 * splitting those would break model-code matching, which the spec's
 * examples never ask for.
 */
const GROUP_LETTER_RUNS = new Set([
  "promax",
  "honda",
  "nintendo",
  "switch",
  "iphone",
  "rayban",
]);

/**
 * Ad-text tokens with the HANDOFF-N breaking rules applied. A token
 * splits at a letter–digit boundary ONLY when the digit run is at an
 * edge — exactly two runs, one all-digits, one all-letters — and the
 * token carries Persian script or a listed Latin group run. A digit run
 * between two letter runs («سوییچ۴نینتندو», «ویلایی130متری») NEVER
 * splits (owner decision 2026-11-02, re-run amendment 1). «دنامدل» alone
 * splits to [دنا، مدل] (the only seen case).
 */
function adTextTokens(adText: string): string[] {
  const norm = normalizeForMatch(adText);
  if (!norm) return [];
  const out: string[] = [];
  for (const tok of norm.split(" ")) {
    const runs = tok.match(/[0-9۰-۹٠-٩]+|[^0-9۰-۹٠-٩]+/g) ?? [tok];
    let pieces: string[];
    if (
      runs.length === 2 &&
      runs.some((r) => /^[0-9۰-۹٠-٩]+$/.test(r))
    ) {
      const letterRun = runs.find(
        (r) => !/^[0-9۰-۹٠-٩]+$/.test(r)
      )!;
      const hasPersian = /[\u0600-\u06FF]/.test(tok);
      pieces =
        hasPersian || GROUP_LETTER_RUNS.has(letterRun.toLowerCase())
          ? runs
          : [tok];
    } else {
      pieces = [tok];
    }
    for (const p of pieces) {
      if (p === "دنامدل") out.push("دنا", "مدل");
      else out.push(p);
    }
  }
  return out
    .map(stemToken)
    .filter((t) => t.length > 0 && !AFFIX_ONLY.has(t));
}

function lookupMap<T>(map: Record<string, T>, key: string): T | undefined {
  return map[key] ?? map[key.toLowerCase()];
}

/**
 * Canonicalize a token list through the closed maps: pairs first, then
 * glued splits, then single substitutions. Iterated to a fixpoint (cap 4)
 * so a split result can still meet a pair map («2خوابه» → [2، خوابه] →
 * [دو، خوابه]); the maps only move variants toward canonical forms, so
 * iteration terminates. Replacements pass through stemToken.
 */
function canonicalizeTokens(
  tokens: string[],
  includeSynonyms: boolean
): string[] {
  let cur = [...tokens];
  for (let round = 0; round < 4; round++) {
    const paired: string[] = [];
    for (let i = 0; i < cur.length; i++) {
      const pairKey = i + 1 < cur.length ? `${cur[i]} ${cur[i + 1]}` : "";
      const rep =
        lookupMap(SPELLING_PAIR_MAP, pairKey) ??
        (includeSynonyms ? lookupMap(INCLUDE_PAIR_MAP, pairKey) : undefined);
      if (rep) {
        paired.push(...rep.map(stemToken));
        i++;
      } else {
        paired.push(cur[i]);
      }
    }
    const split: string[] = [];
    for (const t of paired) {
      const rep = lookupMap(SPELLING_SPLIT_MAP, t);
      split.push(...(rep ? rep.map(stemToken) : [t]));
    }
    const singled = split.map(
      (t) =>
        lookupMap(SPELLING_SINGLE_MAP, t) ??
        (includeSynonyms ? lookupMap(INCLUDE_SINGLE_MAP, t) : undefined) ??
        t
    );
    const same =
      singled.length === cur.length &&
      singled.every((t, i) => t === cur[i]);
    cur = singled;
    if (same) break;
  }
  return cur;
}

function sequenceMatches(hay: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  if (needle.length === 1) return hay.includes(needle[0]);
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((t, k) => hay[i + k] === t)) return true;
  }
  return false;
}

/**
 * True if canonicalized ad tokens contain the term/phrase as a contiguous
 * token subsequence, with the closed-list equivalence applied.
 * `includeSynonyms` adds groups 17–22 (include path only); the plain path
 * applies spelling groups 1–16 only, so excludes never gain synonyms.
 *
 * Phase 1.4 note: `term` may already be a stemmed synonym key (textMatches
 * feeds expandSynonyms output back here), and stemming is NOT idempotent
 * for ی-final words («لباسشویی» → «لباسشوی» → «لباسشو»). Both the raw
 * normalized and the stemmed key are therefore accepted.
 */
function containsNormalizedTerm(
  adText: string,
  term: string,
  includeSynonyms = false
): boolean {
  // HANDOFF-2 layer A2: spaceless matching is an ADDITIONAL path (OR) —
  // it never removes an existing match. It runs for both include and
  // exclude (both callers reach this function), with the full verdict.
  if (spacelessMatches(adText, term)) return true;
  const adTokens = canonicalizeTokens(adTextTokens(adText), includeSynonyms);
  if (adTokens.length === 0) return false;
  const raw = normalizeForMatch(term);
  const keys = new Set([raw, synonymKey(term)]);
  keys.delete("");
  if (keys.size === 0) return false;
  return [...keys].some((key) => {
    const keyTokens = canonicalizeTokens(
      key.split(" ").filter(Boolean),
      includeSynonyms
    );
    return sequenceMatches(adTokens, keyTokens);
  });
}

/**
 * Return the explicitly related-but-not-equivalent terms for a query concept.
 * These terms are only surfaced as related evidence; they must never be
 * treated as exact aliases or used to satisfy a MUST as an exact match.
 */
export function relatedConceptTerms(term: string, category?: string): string[] {
  const key = synonymKey(term);
  if (!category || category === "" || category === "all") return [];
  const concepts = (synonymIndex.get(key) ?? []).filter((concept) =>
    conceptAppliesToCategory(concept, category)
  );
  return [...new Set(concepts.flatMap((concept) => concept.related.map(synonymKey)))];
}

/** True if ad text contains this concept's related-but-distinct neighbor. */
export function textMatchesRelated(adText: string, term: string, category?: string): boolean {
  return relatedConceptTerms(term, category).some((related) =>
    containsNormalizedTerm(adText, related)
  );
}

/**
 * True if the ad text contains the term or an exact alias applicable to the
 * supplied category. Related concepts do not count as exact evidence.
 * The plain path applies spelling groups 1–16 only (excludes included).
 */
export function textMatches(adText: string, term: string, category?: string): boolean {
  return expandSynonyms(term, category).some((syn) =>
    containsNormalizedTerm(adText, syn, false)
  );
}

/**
 * HANDOFF-N: the include path. Same as textMatches, plus synonym/suffix
 * groups 17–22. The pipeline calls this for include terms only; excludes
 * keep the plain path.
 */
export function textMatchesInclude(adText: string, term: string, category?: string): boolean {
  return expandSynonyms(term, category).some((syn) =>
    containsNormalizedTerm(adText, syn, true)
  );
}

/**
 * HANDOFF-2 (2026-11-02) layer A2 — spaceless matching.
 *
 * A term/phrase matches if its spaceless form (layer-A normalized, all
 * spaces removed) equals the spaceless form of 1 to 3 CONSECUTIVE ad
 * words. Full equality only — «جارو» never matches «جاروبرقی» — and the
 * spaceless form must be at least 4 letters. A digit or mark between
 * the glued pieces blocks the match: digits survive as tokens (so they
 * break equality), and marks are replaced by a sentinel word before
 * normalization, so a mark splits the token run («جارو، برقی» never
 * matches «جاروبرقی», while «جارو برقی» and «جارو‌برقی» do).
 *
 * This only ADDS matches (amendment 2): it is OR-ed into
 * containsNormalizedTerm, never replacing an existing match path.
 */
// Must mirror normalizeForMatch's punctuation set exactly: every char
// it turns into a space becomes a sentinel word here instead.
const MARK_SENTINEL = "ZZMARKZZ";
const MARK_RE =
  /[.,،؛:!؟?()«»""''\[\]{}<>|/\\\-–—_+=*~@#$%^&`]/g;

export function spacelessMatches(adText: string, term: string): boolean {
  // The ≥4 guard reads the unstemmed form; the comparison itself stems
  // BOTH sides. Callers pass stemmed synonym keys («جاروبرقی» arrives
  // as «جاروبرق»), so an unstemmed comparison would never meet a
  // stemmed ad token («برقی» → «برق») — the stemming must be symmetric.
  const termSpaceless = normalizeForMatch(term).replace(/ /g, "");
  if (termSpaceless.length < 4) return false;
  const termStemmed = normalizeForMatch(term)
    .split(" ")
    .filter(Boolean)
    .map(stemToken)
    .join("");
  const tokens = normalizeForMatch(
    adText.replace(MARK_RE, ` ${MARK_SENTINEL} `)
  )
    .split(" ")
    .filter(Boolean)
    .map((t) => (t === MARK_SENTINEL ? t : stemToken(t)));
  // Scan each sentinel-free run for a 1–3-word window whose spaceless
  // concatenation equals the term's spaceless form.
  let run: string[] = [];
  const runMatches = (runTokens: string[]): boolean => {
    for (let i = 0; i < runTokens.length; i++) {
      let concat = "";
      for (let len = 1; len <= 3 && i + len <= runTokens.length; len++) {
        concat += runTokens[i + len - 1];
        if (concat === termStemmed) return true;
      }
    }
    return false;
  };
  for (const t of tokens) {
    if (t === MARK_SENTINEL) {
      if (runMatches(run)) return true;
      run = [];
    } else {
      run.push(t);
    }
  }
  return runMatches(run);
}

/**
 * HANDOFF-2 (2026-11-02) layer B — brand set (B4).
 *
 * Every brand/model name in the engine's own lists, plus exactly the
 * fourteen names the handoff lists. Nothing else is added. Stored in
 * spaceless layer-A form (so «ری‌بن» is «ریبن» and «ال‌جی» is «الجی»),
 * which is the form the one-letter predicate compares. Latin forms
 * (honda, nintendo, switch, iphone, rayban, promax, ps5) are listed
 * for completeness but never reach this check — the Latin-letter ban
 * in subjectMatchesByOneLetter fires first.
 *
 * Sources: HEAD_KIND makes/models (kindLexicon), the N spelling maps'
 * brand/model entries (persianNormalize), K2 console topics
 * (semantics), and the handoff's fourteen.
 */
export const BRAND_SET: ReadonlySet<string> = new Set(
  [
    // HEAD_KIND makes/models.
    "پراید",
    "پژو",
    "سمند",
    "دنا",
    "تیبا",
    // N spelling maps: canonical forms and their listed variants.
    "هوندا",
    "هندا",
    "نینتندو",
    "نیتندو",
    "سوییچ",
    "سویچ",
    "آیفون",
    "ری‌بن",
    "پرو مکس",
    "دنا پلاس",
    // K2 console topics (Persian forms above; Latin forms below).
    "ps5",
    // Latin forms of the N/K2 brands, for completeness (defense in
    // depth — the Latin-letter ban fires before this check in practice).
    "honda",
    "nintendo",
    "switch",
    "iphone",
    "rayban",
    "promax",
    // The handoff's fourteen, exactly as written.
    "سامسونگ",
    "سامسونت",
    "اپل",
    "شیائومی",
    "هوآوی",
    "ال‌جی",
    "سونی",
    "نوکیا",
    "لنوو",
    "ایسوس",
    "ایسر",
    "پاناسونیک",
    "توشیبا",
    "هایسنس",
    "اسنوا",
  ].map((w) => normalizeForMatch(w).replace(/ /g, ""))
);

/** True when two layer-A spaceless forms differ by exactly one letter: one substitution, one deletion, or one insertion. Transpositions (two operations) do not count. */
export function isOneLetterDifferent(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffs += 1;
        if (diffs > 1) return false;
      }
    }
    return diffs === 1;
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
    } else if (!skipped) {
      skipped = true;
      j += 1;
    } else {
      return false;
    }
  }
  return true;
}

const HAS_DIGIT_OR_LATIN = /[0-9۰-۹٠-٩A-Za-z]/;

/**
 * HANDOFF-2 (2026-11-02) layer B predicate — the full B2 condition
 * except head-ness and subject-ness, which the pipeline enforces
 * (it passes the title HEAD and the first include term only).
 *
 * Both words are compared in spaceless layer-A form: at least 5
 * letters each, no digit or Latin letter in either, exactly one
 * letter apart, and neither in the brand set. Layer A having already
 * matched is checked by the caller (B is only tried after layer A
 * fails), so it is not part of this predicate.
 */
export function subjectMatchesByOneLetter(
  subjectWord: string,
  titleWord: string
): boolean {
  const subject = normalizeForMatch(subjectWord).replace(/ /g, "");
  const title = normalizeForMatch(titleWord).replace(/ /g, "");
  if (subject.length < 5 || title.length < 5) return false;
  if (HAS_DIGIT_OR_LATIN.test(subject) || HAS_DIGIT_OR_LATIN.test(title)) {
    return false;
  }
  if (BRAND_SET.has(subject) || BRAND_SET.has(title)) return false;
  return isOneLetterDifferent(subject, title);
}
