import type { ContextBase } from "@/lib/search-context";

export interface RecentHunt {
  query: string;
  base: ContextBase;
  ts: number;
}

const STORAGE_KEY = "shakar:recent-hunts:v1";
const MAX_HUNTS = 5;

function isValidHunt(value: unknown): value is RecentHunt {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.query === "string" && typeof v.base === "object" && v.base !== null;
}

/**
 * Local, honest hunt history. Only hunts the user actually fired are
 * recorded — never suggested or fabricated. Shown on Home when non-empty.
 */
export function readRecentHunts(): RecentHunt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHunt).slice(0, MAX_HUNTS);
  } catch {
    return [];
  }
}

/** Prepends a hunt (deduplicated by query), returns the updated list. */
export function recordRecentHunt(query: string, base: ContextBase): RecentHunt[] {
  const trimmed = query.trim();
  if (trimmed === "") return readRecentHunts();
  const next: RecentHunt[] = [
    { query: trimmed, base: { ...base }, ts: Date.now() },
    ...readRecentHunts().filter((h) => h.query !== trimmed),
  ].slice(0, MAX_HUNTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: history simply won't persist.
  }
  return next;
}
