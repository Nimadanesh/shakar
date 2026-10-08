"use client";

import { useCallback, useMemo } from "react";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { invalidateCached } from "@/lib/session-cache";
import { syncFavoriteToggle } from "@/hooks/useProfileSync";

const STORAGE_KEY = "shakar:favorites:v1";
const CACHE_KEY = "favorites";

/**
 * Backend-ready favorite record. The provider is part of the identity —
 * a bare adId would collide the day a second listing provider exists.
 * Fixture ids are local-only; the backend stores the real provider ad id
 * in sourceAdId.
 */
export interface FavoriteRecord {
  adId: string;
  source: "divar";
  sourceAdId: string;
  savedAt: number;
}

function normalizeRecord(raw: unknown): FavoriteRecord | null {
  if (typeof raw === "string" && raw !== "") {
    // Legacy shape: bare id list. Fixture ids double as the source id.
    return { adId: raw, source: "divar", sourceAdId: raw, savedAt: Date.now() };
  }
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as { adId?: unknown; source?: unknown; sourceAdId?: unknown; savedAt?: unknown };
  if (typeof v.adId !== "string" || v.adId === "") return null;
  return {
    adId: v.adId,
    source: "divar",
    sourceAdId: typeof v.sourceAdId === "string" && v.sourceAdId !== "" ? v.sourceAdId : v.adId,
    savedAt: typeof v.savedAt === "number" ? v.savedAt : Date.now(),
  };
}

function readRecords(): FavoriteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const records = parsed
      .map(normalizeRecord)
      .filter((r): r is FavoriteRecord => r !== null);
    return records;
  } catch {
    return [];
  }
}

export function readFavoriteIds(): string[] {
  return readRecords().map((r) => r.adId);
}

/** Full records — the shape the backend migration consumes. */
export function readFavoriteRecords(): FavoriteRecord[] {
  return readRecords();
}

function writeStored(ids: string[]): void {
  const prev = new Map(readRecords().map((r) => [r.adId, r]));
  const now = Date.now();
  const records: FavoriteRecord[] = ids.map(
    (adId) =>
      prev.get(adId) ?? { adId, source: "divar", sourceAdId: adId, savedAt: now }
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable: state still works for this session.
  }
}

/** Module-level toggle for resuming a gated favorite after auth (no hook needed). */
export function toggleFavoriteStored(adId: string): void {
  const ids = readFavoriteIds();
  const next = ids.includes(adId) ? ids.filter((id) => id !== adId) : [...ids, adId];
  writeStored(next);
  invalidateCached(CACHE_KEY);
}

/**
 * Local-only favorites. Real persistence/auth arrives with the backend;
 * until then favorites live in this browser only and are never presented
 * as synced account state.
 *
 * Backed by the session cache: revisits within a session render instantly
 * instead of flashing empty → filled on every navigation.
 */
export function useFavorites() {
  const { value } = useHydratedStore<string[]>(CACHE_KEY, readFavoriteIds);
  const ids = useMemo(() => value ?? [], [value]);

  const toggle = useCallback(
    (adId: string) => {
      const isNowFavorite = !ids.includes(adId);
      const next = isNowFavorite ? [...ids, adId] : ids.filter((id) => id !== adId);
      writeStored(next);
      // Write-through: when logged in, mirror to the server profile so any
      // device sees it (navid 2026-10-08). Best-effort; local already won.
      syncFavoriteToggle(adId, isNowFavorite);
      // The invalidation event makes this hook (and every other mounted
      // favorites reader) re-read the just-written value immediately.
      invalidateCached(CACHE_KEY);
    },
    [ids]
  );

  const isFavorite = useCallback((adId: string) => ids.includes(adId), [ids]);

  return { isFavorite, toggle };
}
