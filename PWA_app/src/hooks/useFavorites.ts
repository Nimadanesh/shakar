"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "shakar:favorites:v1";

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Module-level toggle for resuming a gated favorite after auth (no hook needed). */
export function toggleFavoriteStored(adId: string): void {
  const ids = readStored();
  const next = ids.includes(adId) ? ids.filter((id) => id !== adId) : [...ids, adId];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Local-only favorites. Real persistence/auth arrives with the backend;
 * until then favorites live in this browser only and are never presented
 * as synced account state.
 */
export function useFavorites() {
  // Hydration-safe: the server can't see localStorage — first render
  // (both sides) is empty; stored ids land after mount.
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe init (see above)
    setIds(readStored());
  }, []);

  const toggle = useCallback((adId: string) => {
    setIds((prev) => {
      const next = prev.includes(adId) ? prev.filter((id) => id !== adId) : [...prev, adId];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: state still works for this session.
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((adId: string) => ids.includes(adId), [ids]);

  return { isFavorite, toggle };
}
