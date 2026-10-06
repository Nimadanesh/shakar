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
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
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
