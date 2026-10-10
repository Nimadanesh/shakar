import "server-only";

import { DIVAR_PLACES } from "@/data/divar-places";
import { ProviderError } from "./provider";

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

/**
 * Shekaar city slug ("tehran") → Divar numeric city id ("1"), resolved from
 * the canonical catalog (`src/data/divar-places.ts`, generated from Divar's
 * official place response) — no network, no drift from the picker.
 * Returns null only when the slug is genuinely absent from the catalog
 * (stale stored value or hand-crafted input). Callers must NOT silently
 * fall back to all-cities in that case — use `requireCityId` so the
 * failure stays visible instead of searching the wrong scope.
 */
export async function resolveCityId(slug: string): Promise<string | null> {
  const match = DIVAR_PLACES.find((c) => c.slug === slug);
  return match ? String(match.id) : null;
}

/**
 * Strict variant for hunt execution paths: "all" resolves to "" (every
 * city, explicitly requested); any other slug resolves to its Divar id.
 * Throws a `bad-request` ProviderError for an unrecognized slug instead
 * of silently running an all-city hunt the user never asked for.
 */
export async function requireCityId(slug: string): Promise<string> {
  if (slug === "all" || slug === "") return "";
  const id = await resolveCityId(slug);
  if (id === null) {
    throw new ProviderError("bad-request", `Unknown city slug: ${slug}`);
  }
  return id;
}
