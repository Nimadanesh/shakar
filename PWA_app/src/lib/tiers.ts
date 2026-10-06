/**
 * Canonical subscription tier metadata — client-safe (no server-only
 * imports). The kamin engine is the source of truth for slots/cadence;
 * it imports from here so the plans UI can never drift from enforcement.
 */

export interface TierMeta {
  key: string;
  /** Persian display name. */
  name: string;
  /** Max ACTIVE kamins (hard slot limit — navid 2026-10-06). */
  kaminSlots: number;
  /** Check cadence key (engine values: daily/hourly/30min/15min/5min). */
  cadence: string;
  /** Persian cadence label for the plans UI. */
  cadenceFa: string;
}

export const TIERS: TierMeta[] = [
  { key: "paye", name: "پایه", kaminSlots: 1, cadence: "daily", cadenceFa: "روزانه" },
  { key: "herfei", name: "حرفه‌ای", kaminSlots: 3, cadence: "hourly", cadenceFa: "ساعتی" },
  { key: "vizhe", name: "ویژه", kaminSlots: 5, cadence: "30min", cadenceFa: "هر ۳۰ دقیقه" },
  {
    key: "namayandegi",
    name: "نمایندگی",
    kaminSlots: 8,
    cadence: "15min",
    cadenceFa: "هر ۱۵ دقیقه",
  },
  { key: "almas", name: "الماس", kaminSlots: 15, cadence: "5min", cadenceFa: "هر ۵ دقیقه" },
];

export function tierByKey(key: string | null | undefined): TierMeta | null {
  if (!key) return null;
  return TIERS.find((t) => t.key === key) ?? null;
}
