import { normalizePersian } from "@/lib/normalizePersian";
import { DIVAR_PLACES, DIVAR_PLACE_PROVINCE, DIVAR_PROVINCES } from "@/data/divar-places";

/**
 * Shared place matching for the city picker, query interpretation, and
 * definition normalization — the client-safe half of the single source of
 * truth (`src/data/divar-places.ts`, generated from Divar's official
 * catalog). Server code imports this module too; it must never gain a
 * server-only import.
 *
 * Matching normalizes Persian/Arabic variants, whitespace, and ZWNJ
 * consistently on both sides. There is deliberately NO broad fuzzy
 * matching: an unknown spelling stays unknown rather than silently
 * becoming the wrong city.
 */

/**
 * Spelling aliases preserved from the previous hand-curated KNOWN_CITIES.
 * Each was verified against the official catalog name shown: the alias is
 * a genuine orthographic variant, never a different place.
 * - urmia: official «ارومیه»
 * - bandar-abbas: official «بندرعباس»
 * - khorramabad: official «خرم‌آباد»
 */
export const PLACE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  urmia: ["اورمیه"],
  "bandar-abbas": ["بندر عباس"],
  khorramabad: ["خرم آباد"],
};

/** Canonical matching form: Arabic variants folded, ZWNJ → space. */
export function normalizePlaceText(input: string): string {
  return normalizePersian(input)
    .replace(/‌/g, " ")
    .replace(/آ/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * All matchable spellings for one place: the official name, ZWNJ/space and
 * آ/ا orthographic variants, then preserved aliases. Display must always
 * use the official `name`, never a variant.
 */
export function placeNameVariants(name: string, aliases: readonly string[] = []): string[] {
  const forms = new Set<string>([name]);
  if (name.includes("‌")) forms.add(name.replace(/‌/g, " "));
  if (name.includes("آ")) forms.add(name.replace(/آ/g, "ا"));
  if (name.includes("‌") && name.includes("آ")) {
    forms.add(name.replace(/‌/g, " ").replace(/آ/g, "ا"));
  }
  for (const a of aliases) forms.add(a);
  return [...forms];
}

export interface PlaceNames {
  readonly slug: string;
  /** Official display name first, then match-only variants. */
  readonly names: readonly string[];
}

/** Every supported place with its matchable names, in catalog order. */
export const KNOWN_PLACES: readonly PlaceNames[] = DIVAR_PLACES.map((p) => ({
  slug: p.slug,
  names: placeNameVariants(p.name, PLACE_ALIASES[p.slug] ?? []),
}));

/** Flat match entries (one per spelling variant), in catalog order. */
export const PLACE_MATCH_ENTRIES: readonly { readonly slug: string; readonly name: string }[] =
  KNOWN_PLACES.flatMap((p) => p.names.map((name) => ({ slug: p.slug, name })));

export function placeBySlug(slug: string): { readonly id: number; readonly slug: string; readonly name: string } | null {
  return DIVAR_PLACES.find((p) => p.slug === slug) ?? null;
}

/** Official Persian label for a supported slug, or the slug itself. */
export function placeLabel(slug: string): string {
  return placeBySlug(slug)?.name ?? slug;
}

export function isPlaceSlug(slug: string): boolean {
  return placeBySlug(slug) !== null;
}

/** Matchable names (official + variants + aliases) for one slug. */
export function placeNamesForSlug(slug: string): readonly string[] {
  return KNOWN_PLACES.find((p) => p.slug === slug)?.names ?? [];
}

/** Search haystack for one picker option: official name plus every
 * match-only spelling (variants + preserved aliases), so «اورمیه» and
 * «بندر عباس» find their official rows instead of an empty sheet. */
export function citySearchText(slug: string): string {
  const official = placeBySlug(slug)?.name ?? slug;
  return [official, ...placeNamesForSlug(slug)].join(" ");
}

// ---------------------------------------------------------------------------
// Multi-location selection sets. Canonical form: an ORDERED array of place
// slugs; the EMPTY array means all locations (exclusive). Legacy single
// `city` strings ("all" or a slug) normalize through `locationSlugs` at
// every boundary so stored hunts and deep links keep working.
// ---------------------------------------------------------------------------

/** Deduplicated slugs in first-occurrence order; blanks dropped. */
export function normalizeLocationSlugs(slugs: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slugs) {
    const t = s.trim();
    if (t === "" || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** True when every slug is a supported catalog place. */
export function isValidLocationSet(slugs: readonly string[]): boolean {
  return slugs.every((s) => isPlaceSlug(s));
}

/**
 * Truthful one-line summary: «همه شهرها» for the all-locations state,
 * official labels joined for a few, «first، second + N» beyond that —
 * the count is never truncated away.
 */
export function locationSummary(slugs: readonly string[], maxShown = 2): string {
  if (slugs.length === 0) return "همه شهرها";
  const labels = slugs.map(placeLabel);
  if (labels.length <= maxShown) return labels.join("، ");
  const rest = labels.length - maxShown;
  return `${labels.slice(0, maxShown).join("، ")} +${rest.toLocaleString("fa-IR")}`;
}

/** Toggle one place in a draft set (pure). Empty stays the all-state. */
export function toggleLocation(draft: readonly string[], slug: string): string[] {
  if (draft.includes(slug)) return draft.filter((s) => s !== slug);
  return [...draft, slug];
}

// ---------------------------------------------------------------------------
// Province hierarchy (generated from Divar's own places-web.json: type-1
// provinces group type-2 places by verified slug — never name guessing).
// ---------------------------------------------------------------------------

export function provinces(): Array<{ readonly slug: string; readonly name: string }> {
  return [...DIVAR_PROVINCES];
}

export function provinceBySlug(slug: string): { readonly id: number; readonly slug: string; readonly name: string } | null {
  return DIVAR_PROVINCES.find((p) => p.slug === slug) ?? null;
}

export function provinceLabel(slug: string): string {
  return provinceBySlug(slug)?.name ?? slug;
}

/** Canonical province slug for a place, or null when unclassified. */
export function provinceOfPlace(placeSlug: string): string | null {
  return DIVAR_PLACE_PROVINCE[placeSlug] ?? null;
}

/** Places of one province in catalog order. */
export function placesByProvince(provinceSlug: string): Array<{ readonly slug: string; readonly name: string }> {
  return DIVAR_PLACES.filter((p) => DIVAR_PLACE_PROVINCE[p.slug] === provinceSlug).map((p) => ({
    slug: p.slug,
    name: p.name,
  }));
}

/** Place count per province slug. */
export function provincePlaceCounts(): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const p of DIVAR_PLACES) {
    const prov = DIVAR_PLACE_PROVINCE[p.slug];
    if (prov !== undefined) counts[prov] = (counts[prov] ?? 0) + 1;
  }
  return counts;
}

/**
 * Safety net: catalog places with no valid province assignment. Must stay
 * empty against current data; the picker renders these under «سایر مکان‌ها»
 * instead of dropping them if drift ever introduces any.
 */
export function unclassifiedPlaces(): Array<{ readonly slug: string; readonly name: string }> {
  const provinces = new Set(DIVAR_PROVINCES.map((p) => p.slug));
  return DIVAR_PLACES.filter((p) => {
    const prov = DIVAR_PLACE_PROVINCE[p.slug];
    return prov === undefined || !provinces.has(prov);
  }).map((p) => ({ slug: p.slug, name: p.name }));
}

/**
 * Distinct place slugs mentioned in free text, in catalog order.
 * Word-boundary matching (no substring inside other words). Multiple
 * mentions resolve to multiple slugs — callers must NOT silently pick one.
 */
export function findMentionedPlaceSlugs(normalizedQuery: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const entry of PLACE_MATCH_ENTRIES) {
    if (seen.has(entry.slug)) continue;
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalizedQuery)) {
      seen.add(entry.slug);
      found.push(entry.slug);
    }
  }
  return found;
}

export interface PlaceRef {
  readonly slug: string;
  readonly name: string;
}

/**
 * Searchable-picker matching over official names + aliases. Ranking:
 * exact label match first, then prefix, then substring; stable otherwise.
 * Pure substring fallback keeps unknown spellings findable-free — an empty
 * result honestly says «شهری با این نام پیدا نشد».
 */
export function searchPlaces(
  query: string,
  places: readonly PlaceRef[] = DIVAR_PLACES,
  limit = 50
): PlaceRef[] {
  const needle = normalizePlaceText(query);
  if (needle === "") return [...places].slice(0, limit);
  const scored: Array<{ slug: string; name: string; rank: number; index: number }> = [];
  places.forEach((p, index) => {
    const label = normalizePlaceText(p.name);
    let rank = -1;
    if (label === needle) rank = 0;
    else if (label.startsWith(needle)) rank = 1;
    else if (label.includes(needle)) rank = 2;
    else {
      const aliases = PLACE_ALIASES[p.slug] ?? [];
      for (const a of aliases) {
        const norm = normalizePlaceText(a);
        if (norm === needle) {
          rank = 0;
          break;
        }
        if (norm.startsWith(needle)) rank = 1;
        else if (norm.includes(needle)) rank = rank < 0 ? 2 : rank;
      }
    }
    if (rank >= 0) scored.push({ slug: p.slug, name: p.name, rank, index });
  });
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.slice(0, limit).map(({ slug, name }) => ({ slug, name }));
}
