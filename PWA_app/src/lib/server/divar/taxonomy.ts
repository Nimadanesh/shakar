import "server-only";

import { divarFetch } from "./throttle";
import { getCached, setCached } from "./cache";
import type { DivarJson } from "./provider";

/**
 * Taxonomy bridge: Shekaar's categories/cities → Divar's API values.
 * Category slugs verified live against api.divar.ir on 2026-10-06
 * (parent slugs are valid search categories).
 */
export const CATEGORY_API_VALUE: Record<string, string> = {
  all: "",
  vehicles: "vehicles",
  "real-estate": "real-estate",
  music: "leisure-hobbies", // آلات موسیقی lives under سرگرمی و فراغت
  mobile: "electronic-devices", // کالای دیجیتال
  home: "home-kitchen", // خانه و آشپزخانه
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

interface DivarCity {
  id: number;
  slug: string;
}

/**
 * Shekaar city slug ("tehran") → Divar numeric city id ("1").
 * Resolved once from /v8/places/cities and cached for 24h — never
 * hardcoded, so Divar-side id changes can't silently break search.
 * Returns null when the slug is unknown (caller falls back to all-cities).
 */
export async function resolveCityId(slug: string): Promise<string | null> {
  const key = "divar:cities";
  let cities = getCached<DivarCity[]>(key);
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
        (c): c is DivarCity =>
          typeof (c as DivarCity)?.id === "number" && typeof (c as DivarCity)?.slug === "string"
      )
      .map((c) => ({ id: c.id, slug: c.slug }));
    setCached(key, cities, CITY_TTL_MS);
  }
  const match = cities.find((c) => c.slug === slug);
  return match ? String(match.id) : null;
}
