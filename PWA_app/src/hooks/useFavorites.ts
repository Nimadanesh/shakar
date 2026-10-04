"use client";

import { useCallback, useState } from "react";

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

/**
 * Local-only favorites. Real persistence/auth arrives with the backend;
 * until then favorites live in this browser only and are never presented
 * as synced account state.
 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(readStored);

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
