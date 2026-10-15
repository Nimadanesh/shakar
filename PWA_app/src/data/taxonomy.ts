import { DIVAR_CITIES } from "@/lib/divarCities";

// Static taxonomy for Phase 1 (no backend taxonomy yet).
// City values are Divar slugs, consistent with interpret.ts KNOWN_CITIES.

export const CATEGORIES = [
  { value: "all", label: "همه دسته‌ها" },
  { value: "vehicles", label: "خودرو" },
  { value: "real-estate", label: "املاک" },
  { value: "music", label: "سرگرمی و فراغت" },
  { value: "mobile", label: "موبایل و کالای دیجیتال" },
  { value: "home", label: "خانه و آشپزخانه" },
  { value: "personal", label: "وسایل شخصی" },
  { value: "services", label: "خدمات" },
  { value: "jobs", label: "استخدام و کاریابی" },
  { value: "industrial", label: "کسب‌وکار و تجهیزات" },
] as const;

export const CITIES = [
  { value: "all", label: "همه شهرها" },
  // The full Divar directory (1177 cities) — generated from /v8/places/cities
  // (scripts/fetch-divar-cities.mjs). 31 provincial capitals first, then
  // Persian alphabetical. Committed statically so the pickers work offline
  // and never layout-shift on a fetch.
  ...DIVAR_CITIES.map((c) => ({ value: c.id, label: c.names[0] })),
] as const;

export function cityLabel(cityId: string): string {
  return CITIES.find((c) => c.value === cityId)?.label ?? cityId;
}

export function categoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.value === categoryId)?.label ?? categoryId;
}
