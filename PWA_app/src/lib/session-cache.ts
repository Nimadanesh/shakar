/**
 * Session-level cache for localStorage-backed reads.
 *
 * The hydration-safe pattern (empty first render, then useEffect fill) is
 * correct for SSR, but it causes a visible flash on EVERY client-side
 * navigation: page components remount, render empty, then pop in content.
 * localStorage data doesn't change between navigations within a session, so
 * the first read is cached here at module scope:
 * - first mount per session → cache miss → skeleton, then real content
 *   (unavoidable once, and SSR-safe);
 * - every later mount → cache hit → real content on the very first render,
 *   zero jump.
 *
 * Mutations MUST invalidate: every store function that writes localStorage
 * calls `invalidateCached(...)` so no component ever renders stale data.
 * Invalidation also dispatches a window event so already-mounted hooks
 * re-read immediately (same pattern as the profile store).
 */

const cache = new Map<string, unknown>();

const EVENT_NAME = "shakar:cache-invalidate";

export function getCached<T>(key: string): T | undefined {
  return cache.has(key) ? (cache.get(key) as T) : undefined;
}

export function setCached(key: string, value: unknown): void {
  cache.set(key, value);
}

/**
 * Drop cached entries and notify mounted hooks to re-read. Call after any
 * localStorage write that changes what `key` would return.
 */
export function invalidateCached(...keys: string[]): void {
  for (const key of keys) cache.delete(key);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<string[]>(EVENT_NAME, { detail: keys }));
  }
}

export function onCacheInvalidated(listener: (keys: string[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<string[]>).detail ?? []);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
