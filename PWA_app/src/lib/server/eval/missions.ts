import "server-only";

import type { MissionDefinition } from "./types";

/**
 * Seeded challenge suite v1 — candidate missions, NOT pre-labelled proof.
 * Query text only; no listings, labels, or expected outcomes live here.
 * Stable ids: never reuse an id for a different query.
 */
export const MISSION_SET_VERSION = 1;

/** Max listings shown per mission run (documented evaluation limit). */
export const MAX_ITEMS_PER_MISSION = 12;

const SEED: ReadonlyArray<Omit<MissionDefinition, "resultSetId" | "liveAllowed">> = [
  {
    id: "m-iphone13pro",
    version: 1,
    enabled: true,
    query: "آیفون ۱۳ پرو",
    taskFa: "یک گوشی آیفون ۱۳ پرو (دقیقاً همین مدل) پیدا کنید.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
  {
    id: "m-iphone13",
    version: 1,
    enabled: true,
    query: "آیفون ۱۳",
    taskFa: "یک گوشی از خانواده آیفون ۱۳ پیدا کنید؛ مدل دقیق مهم نیست.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
  {
    id: "m-iphone13-norepair",
    version: 1,
    enabled: true,
    query: "آیفون ۱۳ بدون تعمیر",
    taskFa: "یک گوشی آیفون ۱۳ پیدا کنید که سابقه تعمیر نداشته باشد.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
  {
    id: "m-fridge-repair",
    version: 1,
    enabled: true,
    query: "تعمیر یخچال",
    taskFa: "یک تعمیرکار یا خدمات تعمیر یخچال پیدا کنید.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
  {
    id: "m-fridge-buyer",
    version: 1,
    enabled: true,
    query: "خریدار یخچال",
    taskFa: "عبارت «خریدار یخچال» را جست‌وجو کنید و بگویید هر آگهی چقدر به همین عبارت می‌خورد.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
  {
    id: "m-fridge",
    version: 1,
    enabled: true,
    query: "یخچال",
    taskFa: "یک یخچال برای خرید پیدا کنید.",
    maxItems: MAX_ITEMS_PER_MISSION,
  },
];

export function seedMissions(): MissionDefinition[] {
  return SEED.map((m) => ({ ...m, resultSetId: null, liveAllowed: false }));
}

export function validateMissionDefinition(body: unknown): MissionDefinition | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const id = str(b.id);
  const query = str(b.query);
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) return null;
  if (query === "" || query.length > 200) return null;
  const maxItems =
    typeof b.maxItems === "number" && Number.isInteger(b.maxItems)
      ? Math.min(Math.max(b.maxItems, 1), MAX_ITEMS_PER_MISSION)
      : MAX_ITEMS_PER_MISSION;
  return {
    id,
    version: typeof b.version === "number" && b.version > 0 ? Math.floor(b.version) : 1,
    enabled: b.enabled !== false,
    query,
    taskFa: str(b.taskFa).slice(0, 500) || query,
    maxItems,
    resultSetId: typeof b.resultSetId === "string" && b.resultSetId !== "" ? b.resultSetId : null,
    liveAllowed: b.liveAllowed === true,
  };
}
