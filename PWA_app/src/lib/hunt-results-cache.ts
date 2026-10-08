import type { HuntDefinition, HuntStats, ScoredAd } from "@/lib/server/hunt/pipeline";

export interface CachedHuntResults {
  results: ScoredAd[];
  stats: HuntStats | null;
  definition: HuntDefinition | null;
  query: string;
  /** When the entry was cached (ms epoch). */
  ts: number;
}

/**
 * In-memory cache of completed hunt results, keyed by run id.
 *
 * ROOT FIX (navid 2026-10-08): returning from an ad's detail page to the
 * hunt's results re-fetched the entire results JSON and re-rendered every
 * card from scratch — on cellular that is seconds of black screen. The
 * results of a completed hunt are IMMUTABLE, so caching them in the module
 * (survives client-side navigations for the tab's lifetime) makes the
 * return instant: render from cache first, revalidate in the background.
 *
 * Bounded: at most 10 hunts, entries expire after 30 minutes (the run TTL
 * for memory-backend runs; DB runs live longer but their results never
 * change either — the bound is about memory, not correctness).
 */
const MAX_ENTRIES = 10;
const ENTRY_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, CachedHuntResults>();

export function getCachedResults(runId: string): CachedHuntResults | null {
  const entry = cache.get(runId);
  if (!entry) return null;
  if (Date.now() - entry.ts > ENTRY_TTL_MS) {
    cache.delete(runId);
    return null;
  }
  // LRU touch.
  cache.delete(runId);
  cache.set(runId, entry);
  return entry;
}

export function setCachedResults(runId: string, data: Omit<CachedHuntResults, "ts">): void {
  cache.delete(runId);
  cache.set(runId, { ...data, ts: Date.now() });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

export function clearCachedResults(runId: string): void {
  cache.delete(runId);
}
