"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "shakar:hidden-ads:v1";

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
 * Local-only hidden listings. Hiding removes the card from this browser's
 * result lists only; it never touches the source inventory.
 */
export function useHiddenAds() {
  const [ids, setIds] = useState<string[]>(readStored);

  const hide = useCallback((adId: string) => {
    setIds((prev) => {
      if (prev.includes(adId)) return prev;
      const next = [...prev, adId];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: state still works for this session.
      }
      return next;
    });
  }, []);

  const unhide = useCallback((adId: string) => {
    setIds((prev) => {
      const next = prev.filter((id) => id !== adId);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isHidden = useCallback((adId: string) => ids.includes(adId), [ids]);

  return { hiddenIds: ids, hide, unhide, isHidden };
}
