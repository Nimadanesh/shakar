"use client";

import { useEffect, useState } from "react";
import { readFavoriteRecords } from "@/hooks/useFavorites";
import { resolveAdDetails } from "@/lib/ad-detail-cache";

export interface FavTitle {
  title: string;
  city: string | null;
}

/**
 * Resolves favorite ad titles/cities when the search sheet opens, so
 * favorites are searchable by their real titles on BOTH /saved and /archive.
 * Backed by the shared ad-detail cache — if the favorites list (or the
 * other page's search) already resolved an ad, no new request fires.
 * A favorite whose ad is gone simply isn't searchable by title.
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
      const details = await resolveAdDetails(missing.map((r) => r.sourceAdId));
      const next = new Map(favTitles);
      for (const r of missing) {
        const d = details.get(r.sourceAdId);
        if (d && !d.failed && d.title !== "") {
          next.set(r.adId, { title: d.title, city: d.city === "" ? null : d.city });
        }
      }
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
