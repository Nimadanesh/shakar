import "server-only";

/**
 * Tiny in-memory TTL cache (M3). Blueprint §3: list pages 2–5 min, details
 * hourly. Single-instance FIFO eviction — good enough until Redis; the
 * interface is narrow so swapping the backend is one file.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 2000;
const store = new Map<string, Entry>();

export function getCached<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  // Expired entries are NOT deleted here — getStale may still serve them
  // during a Divar restriction (bounded by MAX_ENTRIES eviction).
  if (Date.now() > e.expiresAt) return null;
  return e.value as T;
}

/**
 * Stale fallback: returns the entry even when expired, up to maxStaleMs
 * past expiry (default 24h). Used when Divar is rate-limiting or down —
 * serving a slightly old list with an honest "stale" flag beats a dead
 * hunt. The pipeline must surface the staleness; never present stale
 * data as fresh.
 */
export function getStale<T>(key: string, maxStaleMs = 24 * 60 * 60 * 1000): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.expiresAt > maxStaleMs) return null;
  return e.value as T;
}

export function setCached(key: string, value: unknown, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Test/dev escape hatch. */
export function clearCache(): void {
  store.clear();
}
