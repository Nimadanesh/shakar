import "server-only";

import { divarFetch } from "./throttle";
import { getCached, setCached } from "./cache";
import type { DivarJson } from "./provider";
import { DIVAR_CITIES } from "@/lib/divarCities";

/**
 * Taxonomy bridge: Shekaar's categories/cities → Divar's API values.
 * Category slugs verified live against api.divar.ir on 2026-10-06
 * (parent slugs are valid search categories).
 */
export const CATEGORY_API_VALUE: Record<string, string> = {
  all: "",
  vehicles: "vehicles",
  "real-estate": "real-estate",
  music: "leisure-hobbies", // سرگرمی و فراغت (id "music" is historical)
  mobile: "electronic-devices", // کالای دیجیتال
  home: "home-kitchen", // خانه و آشپزخانه
  // services / jobs / industrial / personal: deliberately unmapped ("") —
  // fail open to "all" until their Divar slugs are verified live (post-R3).
  // Listed explicitly so the "covers every app category" test stays green
  // and the fail-open is a decision, not an omission.
  services: "",
  jobs: "",
  industrial: "",
  personal: "",
};

/** Leaf slugs for M4 refinements (all verified live 2026-10-06). */
export const LEAF_CATEGORY = {
  carLight: "light",
  mobilePhones: "mobile-phones",
  apartmentSell: "apartment-sell",
  apartmentRent: "apartment-rent",
  tvProjector: "tv-projector",
} as const;

const CITY_TTL_MS = 24 * 60 * 60 * 1000;
// v2: entries now carry the Persian name (for GET /api/cities).
const CITY_CACHE_KEY = "divar:cities:v2";

interface DivarCity {
  id: number;
  slug: string;
  name: string;
}

/** Raw API shape — name is optional so older mocks/caches without it keep working. */
interface DivarCityJson {
  id: number;
  slug: string;
  name?: string;
}

async function loadCities(): Promise<DivarCity[]> {
  let cities = getCached<DivarCity[]>(CITY_CACHE_KEY);
  if (!cities) {
    const json: unknown = await divarFetch("https://api.divar.ir/v8/places/cities", {
      method: "GET",
      kind: "meta",
    });
    const rawCities: unknown[] = Array.isArray((json as DivarJson)?.cities)
      ? ((json as DivarJson).cities as unknown[])
      : [];
    cities = rawCities
      .filter(
        (c): c is DivarCityJson =>
          typeof (c as DivarCityJson)?.id === "number" &&
          typeof (c as DivarCityJson)?.slug === "string"
      )
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        // The live API always returns names; fall back to the slug so
        // name-less entries (old mocks, stale caches) never break lookup.
        name: typeof c.name === "string" && c.name !== "" ? c.name : c.slug,
      }));
    setCached(CITY_CACHE_KEY, cities, CITY_TTL_MS);
  }
  return cities;
}

/**
 * Shekaar city slug ("tehran") → Divar numeric city id ("1").
 * Resolved once from /v8/places/cities and cached for 24h — never
 * hardcoded, so Divar-side id changes can't silently break search.
 * Returns null when the slug is unknown (caller falls back to all-cities).
 */
export async function resolveCityId(slug: string): Promise<string | null> {
  const cities = await loadCities();
  const match = cities.find((c) => c.slug === slug);
  return match ? String(match.id) : null;
}

/**
 * The full Divar city directory for GET /api/cities — [{ slug, name }].
 * Served from the same 24h cache as resolveCityId (one API shape, one
 * fetch). Order: 31 provincial capitals first, then Persian alphabetical —
 * the committed DIVAR_CITIES order, so the API and the pickers agree.
 */
export async function getAllCities(): Promise<Array<{ slug: string; name: string }>> {
  const cities = await loadCities();
  const rank = new Map(DIVAR_CITIES.map((c, i) => [c.id, i]));
  return cities
    .map((c) => ({ slug: c.slug, name: c.name }))
    .sort((a, b) => {
      const ra = rank.get(a.slug);
      const rb = rank.get(b.slug);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.name.localeCompare(b.name, "fa");
    });
}
