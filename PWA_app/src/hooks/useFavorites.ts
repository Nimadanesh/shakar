"use client";

import { useCallback, useMemo } from "react";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { invalidateCached } from "@/lib/session-cache";

const STORAGE_KEY = "shakar:favorites:v1";
const CACHE_KEY = "favorites";

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStored(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
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
      const next = ids.includes(adId)
        ? ids.filter((id) => id !== adId)
        : [...ids, adId];
      writeStored(next);
      // The invalidation event makes this hook (and every other mounted
      // favorites reader) re-read the just-written value immediately.
      invalidateCached(CACHE_KEY);
    },
    [ids]
  );

  const isFavorite = useCallback((adId: string) => ids.includes(adId), [ids]);

  return { isFavorite, toggle };
}
