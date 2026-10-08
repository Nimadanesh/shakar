"use client";

import { useEffect, useState } from "react";
import { readFavoriteRecords } from "@/hooks/useFavorites";

export interface FavTitle {
  title: string;
  city: string | null;
}

/**
 * Resolves favorite ad titles/cities when the search sheet opens, so
 * favorites are searchable by their real titles on BOTH /saved and /archive.
 * Titles cache in state for the session; a favorite whose ad is gone simply
 * isn't searchable by title.
 */
export function useFavoriteTitles(searchOpen: boolean) {
  const [favTitles, setFavTitles] = useState<Map<string, FavTitle>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchOpen) return;
    const records = readFavoriteRecords();
    const missing = records.filter((r) => !favTitles.has(r.adId));
    if (missing.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const next = new Map(favTitles);
      await Promise.all(
        missing.map(async (r) => {
          try {
            const res = await fetch(`/api/ads/${encodeURIComponent(r.sourceAdId)}`);
            if (!res.ok) return;
            const json = (await res.json()) as {
              ok: boolean;
              data?: { title?: string; city?: string };
            };
            if (json.ok && json.data?.title) {
              next.set(r.adId, { title: json.data.title, city: json.data.city ?? null });
            }
          } catch {
            // A favorite whose ad is gone simply isn't searchable by title.
          }
        })
      );
      if (!cancelled) {
        setFavTitles(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  return { favTitles, favTitlesLoading: loading };
}
