import "server-only";

import type { HuntDefinition } from "./pipeline";
import {
  detectCategoryFromText,
  interpretQuery,
  PREFERENCE_CUES,
  NEGATION_VERBS,
  EXCLUDE_PREFIXES,
  PRICE_STRUCTURAL_WORDS,
} from "@/lib/interpret";
import { isPlaceSlug, placeNamesForSlug } from "@/lib/places";
import { normalizeForMatch, stemToken, tokenize } from "@/lib/persianNormalize";
import type { InterpretedConstraint } from "@/types/search";

/**
 * Validates an incoming hunt/kamin definition. Shared by POST /api/hunts
 * and the kamin APIs — one choke point, so a kamin can never watch a
 * meaning the hunt pipeline couldn't run. Null = 400 garbage.
 */
export function toHuntDefinition(body: unknown): HuntDefinition | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const query = str(b.query).trim();
  if (query === "") return null;
  const transaction = b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "";
  const condition =
    b.condition === "new" || b.condition === "used" || b.condition === "any"
      ? b.condition
      : "";
  const city = str(b.city) || "all";
  // Canonical multi-location selection: explicit `cities` wins; otherwise
  // the legacy single `city`. Unknown slugs fail validation visibly (null
  // = 400) instead of silently widening to all-cities downstream.
  const rawCities = Array.isArray(b.cities)
    ? b.cities.filter((x): x is string => typeof x === "string")
    : city !== "all" && city !== ""
      ? [city]
      : [];
  const cities = [...new Set(rawCities.map((s) => s.trim()).filter((s) => s !== ""))];
  if (cities.some((s) => !isPlaceSlug(s))) return null;
  return {
    query,
    include: strArr(b.include),
    exclude: strArr(b.exclude),
    should: [],
    city: cities[0] ?? "all",
    cities,
    category: str(b.category) || "all",
    priceMin: str(b.priceMin),
    priceMax: str(b.priceMax),
    transaction,
    condition,
    deepHistory: b.deepHistory === true,
  };
}

/**
 * Query resolution — the fix for the «everything matches» incident
 * (2026-10-06: a «پیانو» hunt confirmed pigeons, hay and bicycles).
 *
 * Root cause: the pipeline only matched def.include/def.exclude. The «چی؟»
 * query text — the item the user actually named — was NEVER matched, so a
 * hunt fired with no «باید» chips had include=[] and EVERY ad passed the
 * title/description filters vacuously.
 *
 * resolveHuntDefinition is the single choke point (hunts + kamin arm/run)
 * that turns the raw query into an honest, complete definition:
 *  1. content terms from the query text become MUST (merged into
 *     include) — «پیانو U3 تهران» names پیانو AND U3; matched terms score,
 *     unmatched terms become UNKNOWN (near-miss), never a silent drop
 *     (flaw #19, 2026-10-09);
 *  2. a city named in the text applies when the picker is "all" — an
 *     explicit picker choice (including "all") always wins: the client
 *     dismisses query-city inferences on hand-pick, so only surviving
 *     constraints apply. Multiple distinct city mentions apply nothing
 *     (ambiguous — raw terms stay intact, never guessed);
 *  3. a category named in the text («آپارتمان» → real-estate) applies when
 *     the picker is "all" — without this the provider scans every category
 *     and the 500-ad window dilutes to ~27 apartments (flaw #10,
 *     2026-10-06: «آپارتمان نوساز سعادت‌آباد» found nothing);
 *  4. price bounds named in the text apply when the fields are empty;
 *  5. inline «نه» excludes apply;
 *  6. nothing the user dismissed (by deterministic constraint id) applies;
 *  7. preference cues («ترجیحاً») become SHOULD — ranking boost only,
 *     never a filter (flaw #19).
 *
 * Structural words (applied city names, price expressions, cue words,
 * excludes, preference wishes) never become content terms. Unapplied or
 * unknown place names stay intact.
 */
export function resolveHuntDefinition(body: unknown): HuntDefinition | null {
  const def = toHuntDefinition(body);
  if (!def) return null;

  const dismissed = getDismissedIds(body);
  const interp = interpretQuery(def.query);
  const applied = interp.applied.filter(
    (c) => c.applied && !dismissed.includes(c.id)
  );

  // 1. Mandatory content terms from the query text.
  // The effective city filter decides which place names are structural.
  // A multi-location request keeps its whole set: one surviving inference
  // never overrides it, and the surviving mention stays intact (ambiguous
  // against the set — raw query preserved, never guessed).
  const cityC = applied.find((c) => c.kind === "city");
  const requested: string[] = def.cities ?? [];
  const multiRequest = requested.length > 1;
  const winningCity = multiRequest ? null : cityC ? cityC.value : null;
  // Every city that filters this hunt is structural: the winning query
  // city plus every explicitly requested one. (With a multi-city request,
  // a mentioned member must not linger as an item keyword and silently
  // kill the other cities' ads.)
  const filterCities = [...new Set([...(winningCity ? [winningCity] : []), ...requested])];
  // Dismissed city readings are rejected entirely: neither a filter nor a
  // keyword. Without this, an overridden mention would linger as a MUST
  // term and silently kill the selected scope's ads.
  const dismissedCities = dismissed.filter((id) => id.startsWith("city:")).map((id) => id.slice(5));
  const terms = contentTerms(def.query, applied, interp.preferences, filterCities, dismissedCities);
  const seenTerms = new Set<string>();
  for (const t of def.include) for (const s of tokenize(t)) seenTerms.add(s);
  const include = [...def.include];
  for (const t of terms) {
    const key = stemToken(t);
    if (!seenTerms.has(key)) {
      include.push(t);
      seenTerms.add(key);
    }
  }

  // 2. City: the query text is the freshest signal. An explicit city word
  // beats a stored/remembered picker value (navid 2026-10-08 — the piano
  // hunt's row SHOWED تهران but searched تبریز because the
  // remembered picker silently won). A dismissed inference never reaches
  // `applied`, and an explicit picker choice dismisses the inference
  // client-side — so a surviving conflict always resolves to the text.
  // (cityC/multiRequest were resolved above; reused here.)
  // A multi-location request keeps its whole set: one inferred city must
  // never override an explicit multi-city selection.
  const city = multiRequest ? requested[0] : cityC ? cityC.value : def.city;
  const cities = multiRequest ? requested : cityC ? [cityC.value] : requested;
  const citySource = multiRequest || !cityC ? ("picker" as const) : ("text" as const);

  // 3. Category from text when the picker didn't choose one. Explicit
  // picker wins. An unmapped text category ("personal") falls back to "all"
  // downstream (CATEGORY_API_VALUE ?? "") — fail open, never fail silent.
  const textCategory =
    def.category === "all" || def.category === ""
      ? detectCategoryFromText(def.query)
      : null;
  const category = textCategory ?? def.category;

  // 3. Price bounds from text when the fields are empty.
  const minC = applied.find((c) => c.kind === "priceMin");
  const maxC = applied.find((c) => c.kind === "priceMax");
  let priceMin = def.priceMin.trim() === "" && minC ? minC.value : def.priceMin;
  let priceMax = def.priceMax.trim() === "" && maxC ? maxC.value : def.priceMax;
  // Contradictory bounds (min > max) filter out EVERYTHING — fail open
  // instead of guaranteeing an empty hunt.
  const minN = parsePriceBound(priceMin);
  const maxN = parsePriceBound(priceMax);
  if (minN !== null && maxN !== null && minN > maxN) {
    priceMin = "";
    priceMax = "";
  }

  // 4. Inline «نه» excludes from text.
  const seenEx = new Set<string>();
  for (const t of def.exclude) seenEx.add(tokenize(t).join(" "));
  const exclude = [...def.exclude];
  for (const c of applied) {
    if (c.kind !== "exclude") continue;
    const key = tokenize(c.value).join(" ");
    if (key !== "" && !seenEx.has(key)) {
      exclude.push(c.value);
      seenEx.add(key);
    }
  }

  // 5. SHOULD terms from preference cues («ترجیحاً تمیز», flaw #19).
  // Ranking boost only — never filters, never penalizes. Deduped against
  // MUST/NOT terms (stem-compared, like the include merge above).
  const seenShould = new Set<string>();
  for (const t of def.include) for (const s of tokenize(t)) seenShould.add(s);
  for (const t of def.exclude) for (const s of tokenize(t)) seenShould.add(s);
  const should: string[] = [];
  for (const p of interp.preferences) {
    const key = stemToken(p.value);
    if (p.value !== "" && !seenShould.has(key)) {
      should.push(p.value);
      seenShould.add(key);
    }
  }

  return {
    ...def,
    include,
    exclude,
    should,
    city,
    cities,
    citySource,
    category,
    priceMin,
    priceMax,
  };
}

/** Deterministic constraint ids the user dismissed in the form (rare). */
function getDismissedIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const d = (body as Record<string, unknown>).dismissed;
  return Array.isArray(d)
    ? d.filter((x): x is string => typeof x === "string")
    : [];
}

/**
 * The query's content words: everything that names the wanted item.
 * Structural words are removed: city names, price expressions («زیر ۲۰۰
 * میلیون»), preference cues + wishes («ترجیحاً تمیز»), exclude terms and
 * their cue words («نه», «بدون»).
 *
 * Returns SURFACE forms («گوشی», not «گوش») — textMatches normalizes
 * internally, and surface forms read correctly in «چرا این آگهی؟».
 */
function contentTerms(
  query: string,
  applied: InterpretedConstraint[],
  preferences: InterpretedConstraint[],
  filterCities: string[],
  dismissedCities: string[]
): string[] {
  const surface = normalizeForMatch(query)
    .split(" ")
    .filter((t) => t !== "");
  if (surface.length === 0) return [];
  const structural = new Set<string>();
  const drop = (text: string) => {
    for (const t of tokenize(text)) structural.add(t);
  };
  // NOTE: city names drop at TOKEN level («خرم آباد» drops both «خرم»
  // and «آباد»), so «آباد» never becomes a content term for the city that
  // is actually filtering. Names of merely mentioned but unapplied cities
  // (ambiguous queries, overridden inferences) and unknown words stay
  // intact as content terms — stripping them would silently lose the
  // user's keywords. Slight imprecision for X+آباد place queries
  // («شهرک آباد» vs «شهرک غرب») is the known trade-off — see
  // docs/output-quality.md flaw #8 note.
  // Every city that filters this hunt is structural: the winning query
  // city plus every explicitly requested one. «پیانو تهران» with the
  // picker on تهران must not gain تهران as an item keyword, and a
  // mentioned member of a multi-city set must not linger and silently
  // kill the other cities' ads. Ambiguous or unknown mentions stay
  // intact; explicitly dismissed readings drop entirely (neither filter
  // nor keyword).
  for (const slug of filterCities) for (const name of placeNamesForSlug(slug)) drop(name);
  for (const slug of dismissedCities) for (const name of placeNamesForSlug(slug)) drop(name);
  for (const w of NEGATION_VERBS) drop(w);
  for (const p of EXCLUDE_PREFIXES) drop(p);
  for (const w of PRICE_STRUCTURAL_WORDS) drop(w);
  for (const c of applied) {
    if (
      // City displays are governed by filterCities/dismissedCities above
      // (winning/requested/dismissed) — never dropped blindly here, or an
      // overridden mention would vanish/appear inconsistently.
      c.kind === "priceMin" ||
      c.kind === "priceMax" ||
      c.kind === "exclude" ||
      c.kind === "transaction" ||
      c.kind === "condition"
    ) {
      drop(c.display);
    }
  }
  for (const p of preferences) {
    drop(p.display);
    const cue = preferenceCue(p.display, query);
    if (cue) drop(cue);
  }
  return surface.filter((t) => !structural.has(stemToken(t)));
}

/** The cue word («ترجیحاً»…) that introduced a preference wish, if present. */
function preferenceCue(wish: string, query: string): string | null {
  for (const cue of PREFERENCE_CUES) {
    if (query.includes(cue) && query.indexOf(wish) > query.indexOf(cue)) {
      return cue;
    }
  }
  return null;
}

/**
 * Parse a price bound to toman. Digits-only strings («200000000») and
 * Persian digits both work; garbage → null (no bound, never a crash).
 */
export function parsePriceBound(raw: string): number | null {
  const digits = raw.replace(/[^\d۰-۹]/g, "");
  if (digits === "") return null;
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const en = digits.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
  const n = Number(en);
  return Number.isFinite(n) && n > 0 ? n : null;
}
