"use client";

import { useCallback } from "react";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { invalidateCached } from "@/lib/session-cache";
import { syncHiddenAdToggle } from "@/hooks/useProfileSync";

const STORAGE_KEY = "shakar:hidden-ads:v1";
const CACHE_KEY = "hidden-ads";

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

function writeStored(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: state still works for this session.
  }
}

/**
 * Hidden listings. Hiding removes the card from result lists; it never
 * touches the source inventory.
 *
 * Cross-device (navid 2026-10-08): hides write through to the server
 * profile when logged in (best-effort; local already won), and the
 * profile sync merges the server set on login.
 */
export function useHiddenAds() {
  const { value } = useHydratedStore<string[]>(CACHE_KEY, readStored);
  const ids = value ?? [];

  const hide = useCallback(
    (adId: string) => {
      if (ids.includes(adId)) return;
      const next = [...ids, adId];
      writeStored(next);
      // Write-through: mirror to the server profile when logged in.
      syncHiddenAdToggle(adId, true);
      // Mounted readers (every result list) re-read immediately.
      invalidateCached(CACHE_KEY);
    },
    [ids]
  );

  const unhide = useCallback(
    (adId: string) => {
      if (!ids.includes(adId)) return;
      writeStored(ids.filter((id) => id !== adId));
      syncHiddenAdToggle(adId, false);
      invalidateCached(CACHE_KEY);
    },
    [ids]
  );

  const isHidden = useCallback((adId: string) => ids.includes(adId), [ids]);

  return { hiddenIds: ids, hide, unhide, isHidden };
}
