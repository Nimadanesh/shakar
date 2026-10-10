import { normalizePersian } from "@/lib/normalizePersian";
import { DIVAR_PLACES } from "@/data/divar-places";

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
