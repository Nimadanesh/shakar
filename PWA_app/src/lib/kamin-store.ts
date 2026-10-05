import type { FixtureAd } from "@/data/search-fixtures";
import { buildRadarConfig } from "@/lib/radar";
import { runSearch } from "@/lib/search";
import type { ContextBase } from "@/lib/search-context";
import type { SearchContext } from "@/types/search";

/**
 * An armed کمین: a hunt the user wants watched. Local-only in this phase —
 * "new matches" are computed by honest local diffing (current run minus
 * the seen baseline), never fabricated. Background monitoring and push
 * notifications do not exist yet.
 */
export interface KaminRecord {
  /** Stable id derived from the canonical hunt semantics. */
  id: string;
  name: string;
  ctx: SearchContext;
  /** Ad ids already seen — the baseline new matches are diffed against. */
  seenIds: string[];
  armedAt: number;
}

const STORAGE_KEY = "shakar:kamins:v1";

function normalize(raw: unknown): KaminRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as {
    id?: unknown;
    name?: unknown;
    ctx?: unknown;
    seenIds?: unknown;
    armedAt?: unknown;
  };
  if (typeof v.id !== "string" || v.id === "") return null;
  if (typeof v.name !== "string" || v.name.trim() === "") return null;
  if (typeof v.ctx !== "object" || v.ctx === null) return null;
  return {
    id: v.id,
    name: v.name,
    ctx: v.ctx as SearchContext,
    seenIds: Array.isArray(v.seenIds)
      ? v.seenIds.filter((d): d is string => typeof d === "string")
      : [],
    armedAt: typeof v.armedAt === "number" ? v.armedAt : Date.now(),
  };
}

function readAll(): KaminRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((k): k is KaminRecord => k !== null)
      .sort((a, b) => b.armedAt - a.armedAt);
  } catch {
    return [];
  }
}

function persist(kamins: KaminRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kamins));
  } catch {
    // Storage unavailable: kamins simply won't persist.
  }
}

/**
 * Arms a kamin. The currently visible result ids become the seen baseline,
 * so arming never reports the existing results as "new".
 */
export function armKamin(
  ctx: SearchContext,
  name: string,
  currentIds: string[]
): KaminRecord {
  const radar = buildRadarConfig(ctx, name);
  const record: KaminRecord = {
    id: radar.id,
    name: radar.name,
    ctx: radar.context,
    seenIds: [...currentIds],
    armedAt: Date.now(),
  };
  persist([record, ...readAll().filter((k) => k.id !== record.id)]);
  return record;
}

export function disarmKamin(id: string): void {
  persist(readAll().filter((k) => k.id !== id));
}

export function findKamin(ctx: SearchContext): KaminRecord | null {
  const id = buildRadarConfig(ctx, "").id;
  return readAll().find((k) => k.id === id) ?? null;
}

export function listKamins(): KaminRecord[] {
  return readAll();
}

export function markKaminSeen(id: string, ids: string[]): void {
  persist(readAll().map((k) => (k.id === id ? { ...k, seenIds: [...ids] } : k)));
}

/** Honest local diff: current matches minus the seen baseline. */
export function kaminNewIds(kamin: KaminRecord, ads: FixtureAd[]): string[] {
  try {
    const outcome = runSearch(kamin.ctx, ads);
    const seen = new Set(kamin.seenIds);
    return outcome.results.map((r) => r.adId).filter((adId) => !seen.has(adId));
  } catch {
    return [];
  }
}

/** SearchContext back to an editable base (for re-firing from the inbox). */
export function kaminCtxToBase(ctx: SearchContext): ContextBase {
  return {
    category: ctx.category,
    city: ctx.city,
    priceMin: ctx.priceMin !== null ? String(ctx.priceMin) : "",
    priceMax: ctx.priceMax !== null ? String(ctx.priceMax) : "",
    include: [...ctx.includeKeywords],
    exclude: [...ctx.excludeKeywords],
    hasImage: ctx.hasImage,
  };
}
