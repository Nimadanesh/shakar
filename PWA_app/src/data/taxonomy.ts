// Static taxonomy for Phase 1 (no backend taxonomy yet).
// Values must stay consistent with interpret.ts KNOWN_CITIES.

export const CATEGORIES = [
  { value: "all", label: "همه دسته‌ها" },
  { value: "vehicles", label: "خودرو" },
  { value: "real-estate", label: "املاک" },
  { value: "music", label: "آلات موسیقی" },
  { value: "mobile", label: "موبایل و کالای دیجیتال" },
  { value: "home", label: "خانه و آشپزخانه" },
] as const;

export const CITIES = [
  { value: "all", label: "همه شهرها" },
  { value: "tehran", label: "تهران" },
  { value: "karaj", label: "کرج" },
  { value: "isfahan", label: "اصفهان" },
  { value: "shiraz", label: "شیراز" },
  { value: "mashhad", label: "مشهد" },
  { value: "tabriz", label: "تبریز" },
] as const;

export function cityLabel(cityId: string): string {
  return CITIES.find((c) => c.value === cityId)?.label ?? cityId;
}

export function categoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.value === categoryId)?.label ?? categoryId;
}
