import type { ContextBase } from "@/lib/search-context";

/**
 * A fired hunt: one paid search event, persisted as an asset.
 * The record carries everything needed to re-derive the result set
 * deterministically (query + base + dismissed readings) — the triage
 * page re-runs the matcher from this record, so the stored intent is
 * never silently relaxed or re-interpreted.
 */
export interface HuntRecord {
  id: string;
  query: string;
  base: ContextBase;
  dismissed: string[];
  ts: number;
}

const STORAGE_KEY = "shakar:hunts:v1";
const LEGACY_KEY = "shakar:recent-hunts:v1";
const MAX_HUNTS = 20;

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(raw: unknown): HuntRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as {
    id?: unknown;
    query?: unknown;
    base?: unknown;
    dismissed?: unknown;
    ts?: unknown;
  };
  if (typeof v.query !== "string" || v.query.trim() === "") return null;
  if (typeof v.base !== "object" || v.base === null) return null;
  return {
    id: typeof v.id === "string" && v.id !== "" ? v.id : makeId(),
    query: v.query,
    base: v.base as ContextBase,
    dismissed: Array.isArray(v.dismissed)
      ? v.dismissed.filter((d): d is string => typeof d === "string")
      : [],
    ts: typeof v.ts === "number" ? v.ts : Date.now(),
  };
}

function persist(hunts: HuntRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hunts));
  } catch {
    // Storage unavailable: hunts simply won't persist.
  }
}

function readAll(): HuntRecord[] {
  if (typeof window === "undefined") return [];
  const valid = (list: unknown): HuntRecord[] =>
    Array.isArray(list)
      ? list
          .map(normalize)
          .filter((h): h is HuntRecord => h !== null)
          .slice(0, MAX_HUNTS)
      : [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return valid(JSON.parse(raw));
    // One-time migration from the legacy recent-hunts key.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    const migrated = legacy !== null ? valid(JSON.parse(legacy)) : [];
    if (migrated.length > 0) persist(migrated);
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    return migrated;
  } catch {
    return [];
  }
}

/**
 * Records a fired hunt. Every firing is a paid event, so every firing gets
 * its own record (deduplicated by query — the latest firing wins).
 * Returns null when there is nothing to record.
 */
export function recordHunt(
  query: string,
  base: ContextBase,
  dismissed: ReadonlySet<string> | string[] = []
): HuntRecord | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const record: HuntRecord = {
    id: makeId(),
    query: trimmed,
    base: {
      ...base,
      include: [...base.include],
      exclude: [...base.exclude],
    },
    dismissed: Array.from(dismissed),
    ts: Date.now(),
  };
  const next = [record, ...readAll().filter((h) => h.query !== trimmed)].slice(0, MAX_HUNTS);
  persist(next);
  return record;
}

/** Reads one hunt by its canonical id. Null when unknown — never fabricated. */
export function readHunt(id: string): HuntRecord | null {
  if (id === "") return null;
  return readAll().find((h) => h.id === id) ?? null;
}

/** Newest-first hunt history. */
export function readHunts(): HuntRecord[] {
  return readAll();
}
