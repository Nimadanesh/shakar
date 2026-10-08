import type { ContextBase } from "@/lib/search-context";
import { invalidateCached } from "@/lib/session-cache";

/**
 * A fired hunt: one paid search event, persisted as an asset.
 *
 * SNAPSHOT CONTRACT (frozen 2026-10-06, pre-backend stage):
 * a Hunt is a snapshot. (query + base + dismissed + interpretationVersion)
 * must re-derive the same result set deterministically — the triage page
 * re-runs the matcher from this record, so the stored intent is never
 * silently relaxed or re-interpreted by a newer engine. If the matching
 * algorithm changes tomorrow, last week's Hunt keeps showing last week's
 * results. Money/quota was consumed for THIS hunt ⇒ its result is
 * returnable as-is.
 *
 * Backend mirrors: id, userId (server-derived, never from client),
 * query, includeKeywords[], excludeKeywords[], category, city, priceMin,
 * priceMax, hasImage, interpretation (+version), status, quotaConsumed,
 * createdAt, completedAt, resultCount, results[].
 */
export interface HuntRecord {
  id: string;
  query: string;
  base: ContextBase;
  dismissed: string[];
  ts: number;
  /**
   * Interpretation engine version pinned at fire time. Re-derivation must
   * use this version's rules, never the current engine's.
   */
  interpretationVersion: "v1";
  /** Quota units this hunt consumed. Local hunts always consume exactly 1. */
  quotaConsumed: number;
  /** Local hunts are always completed; the backend adds `processing`. */
  status: "completed";
  /**
   * Server run id (M4+). The real results live on the run — recents and
   * archive link to /hunt/[runId], never to a re-derived fixture replay.
   * Absent for pre-runId records (legacy).
   */
  runId?: string;
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
    interpretationVersion?: unknown;
    quotaConsumed?: unknown;
    status?: unknown;
    runId?: unknown;
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
    // Legacy records predate the snapshot contract: they were fired by the
    // v1 interpretation engine and consumed exactly 1 quota unit.
    interpretationVersion: "v1",
    quotaConsumed:
      typeof v.quotaConsumed === "number" && v.quotaConsumed > 0
        ? v.quotaConsumed
        : 1,
    status: "completed",
    runId: typeof v.runId === "string" && v.runId !== "" ? v.runId : undefined,
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
  dismissed: ReadonlySet<string> | string[] = [],
  runId?: string
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
    interpretationVersion: "v1",
    quotaConsumed: 1,
    status: "completed",
    runId: typeof runId === "string" && runId !== "" ? runId : undefined,
  };
  const next = [record, ...readAll().filter((h) => h.query !== trimmed)].slice(0, MAX_HUNTS);
  persist(next);
  invalidateCached("hunts");
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

/** Removes one hunt from history. Two-step confirmed in the UI. */
export function deleteHunt(id: string): void {
  if (id === "") return;
  persist(readAll().filter((h) => h.id !== id));
  invalidateCached("hunts");
}
