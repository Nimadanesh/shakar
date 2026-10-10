// Static taxonomy for Phase 1 (no backend taxonomy yet).
// City values stay consistent with interpret.ts KNOWN_CITIES: both derive
// from the single source of truth (`src/data/divar-places.ts`, generated
// from Divar's official place catalog — 1,177 places).

import { DIVAR_PLACES } from "./divar-places";

export const CATEGORIES = [
  { value: "all", label: "همه دسته‌ها" },
  { value: "vehicles", label: "خودرو" },
  { value: "real-estate", label: "املاک" },
  { value: "music", label: "آلات موسیقی" },
  { value: "mobile", label: "موبایل و کالای دیجیتال" },
  { value: "home", label: "خانه و آشپزخانه" },
] as const;

export const CITIES: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: "all", label: "همه شهرها" },
  // Official Divar order (major places first), verified labels + slugs.
  ...DIVAR_PLACES.map((p) => ({ value: p.slug, label: p.name })),
];

export function cityLabel(cityId: string): string {
  return CITIES.find((c) => c.value === cityId)?.label ?? cityId;
}

export function categoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.value === categoryId)?.label ?? categoryId;
}
