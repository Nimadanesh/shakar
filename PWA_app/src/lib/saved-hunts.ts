import type { ContextBase } from "@/lib/search-context";
import { invalidateCached } from "@/lib/session-cache";
import { getSession } from "@/lib/auth";

export interface SavedHunt {
  id: string;
  query: string;
  base: ContextBase;
  ts: number;
  /** Server row id (uuid) once mirrored — powers delete write-through. */
  serverId?: string;
}

const STORAGE_KEY = "shakar:saved-hunts:v1";
const MAX_SAVED = 20;

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(raw: unknown): SavedHunt | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as {
    id?: unknown;
    query?: unknown;
    base?: unknown;
    ts?: unknown;
  };
  if (typeof v.id !== "string" || v.id === "") return null;
  if (typeof v.query !== "string" || v.query.trim() === "") return null;
  if (typeof v.base !== "object" || v.base === null) return null;
  const b = v.base as Partial<ContextBase>;
  return {
    id: v.id,
    query: v.query,
    base: {
      category: typeof b.category === "string" ? b.category : "all",
      city: typeof b.city === "string" ? b.city : "all",
      priceMin: typeof b.priceMin === "string" ? b.priceMin : "",
      priceMax: typeof b.priceMax === "string" ? b.priceMax : "",
      include: Array.isArray(b.include)
        ? b.include.filter((t): t is string => typeof t === "string")
        : [],
      exclude: Array.isArray(b.exclude)
        ? b.exclude.filter((t): t is string => typeof t === "string")
        : [],
      hasImage: b.hasImage === true,
      transaction: b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "",
      condition:
        b.condition === "new" || b.condition === "used" || b.condition === "any"
          ? b.condition
          : "",
    },
    ts: typeof v.ts === "number" ? v.ts : Date.now(),
    serverId: typeof (v as { serverId?: unknown }).serverId === "string" ? (v as { serverId: string }).serverId : undefined,
  };
}

/**
 * Defensive ContextBase from a server-side hunt definition (history merge,
 * saved-hunt merge). Unknown shapes degrade to "all"/empty — never null.
 */
export function normalizeBase(def: unknown): ContextBase {
  if (typeof def !== "object" || def === null) {
    return {
      category: "all", city: "all", priceMin: "", priceMax: "",
      include: [], exclude: [], hasImage: false, transaction: "", condition: "",
    };
  }
  const b = def as Partial<ContextBase>;
  return {
    category: typeof b.category === "string" ? b.category : "all",
    city: typeof b.city === "string" ? b.city : "all",
    priceMin: typeof b.priceMin === "string" ? b.priceMin : "",
    priceMax: typeof b.priceMax === "string" ? b.priceMax : "",
    include: Array.isArray(b.include)
      ? b.include.filter((t): t is string => typeof t === "string")
      : [],
    exclude: Array.isArray(b.exclude)
      ? b.exclude.filter((t): t is string => typeof t === "string")
      : [],
    hasImage: b.hasImage === true,
    transaction: b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "",
    condition:
      b.condition === "new" || b.condition === "used" || b.condition === "any"
        ? b.condition
        : "",
  };
}

function persist(list: SavedHunt[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the save is session-only.
  }
}

function readAll(): SavedHunt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map(normalize)
          .filter((s): s is SavedHunt => s !== null)
          .slice(0, MAX_SAVED)
      : [];
  } catch {
    return [];
  }
}

/**
 * Saves a hunt definition for one-tap re-run. Deduplicated by query —
 * re-saving the same query refreshes it to the top. Unlike history,
 * saving is explicit and never automatic.
 *
 * CONTRACT (frozen 2026-10-06): SavedHunt ≠ Hunt. A saved hunt is a
 * DEFINITION (query + base), never a foreign key to a fired Hunt.
 * Re-running a saved hunt fires a brand-new Hunt (new id, new quota
 * consumption, new snapshot) — the definition itself is immutable and
 * carries no results.
 */
export function saveHunt(query: string, base: ContextBase): SavedHunt | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const record: SavedHunt = {
    id: makeId(),
    query: trimmed,
    base: {
      ...base,
      include: [...base.include],
      exclude: [...base.exclude],
    },
    ts: Date.now(),
  };
  const next = [record, ...readAll().filter((s) => s.query !== trimmed)].slice(
    0,
    MAX_SAVED
  );
  persist(next);
  invalidateCached("saved-hunts");
  // Write-through: when logged in, mirror to the server profile so any
  // device sees it (navid 2026-10-08). Best-effort; local already won.
  void syncSavedHuntCreate(record);
  return record;
}

/** Best-effort server mirror of a saved-hunt create. Patches the local
 *  record with the server row id for delete write-through. */
async function syncSavedHuntCreate(record: SavedHunt): Promise<void> {
  if (typeof window === "undefined" || !getSession()) return;
  try {
    const res = await fetch("/api/me/saved-hunts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: record.query,
        definition: { query: record.query, base: record.base },
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { id?: unknown };
    } | null;
    const serverId = json?.ok === true ? json.data?.id : null;
    if (typeof serverId === "string" && serverId !== "") {
      persist(readAll().map((s) => (s.id === record.id ? { ...s, serverId } : s)));
      invalidateCached("saved-hunts");
    }
  } catch {
    // Best-effort; the local save already succeeded.
  }
}

/** Best-effort server mirror of a saved-hunt delete. */
function syncSavedHuntDelete(serverId: string): void {
  if (typeof window === "undefined" || !getSession() || serverId === "") return;
  fetch(`/api/me/saved-hunts?id=${encodeURIComponent(serverId)}`, {
    method: "DELETE",
  }).catch(() => {
    // Best-effort; the local delete already succeeded.
  });
}

/** Newest-first saved hunts. */
export function readSavedHunts(): SavedHunt[] {
  return readAll();
}

/** True when a hunt with this query is saved. */
export function isHuntSaved(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed === "") return false;
  return readAll().some((s) => s.query === trimmed);
}

/** Removes one saved hunt. Two-step confirmed in the UI. */
export function deleteSavedHunt(id: string): void {
  if (id === "") return;
  const doomed = readAll().filter((s) => s.id === id);
  persist(readAll().filter((s) => s.id !== id));
  invalidateCached("saved-hunts");
  for (const s of doomed) {
    if (s.serverId) syncSavedHuntDelete(s.serverId);
  }
}

/** Removes the saved hunt matching this query, if any. */
export function unsaveHunt(query: string): void {
  const trimmed = query.trim();
  if (trimmed === "") return;
  const doomed = readAll().filter((s) => s.query === trimmed);
  persist(readAll().filter((s) => s.query !== trimmed));
  invalidateCached("saved-hunts");
  for (const s of doomed) {
    if (s.serverId) syncSavedHuntDelete(s.serverId);
  }
}
