"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { FavoriteRow } from "@/components/ads/FavoriteRow";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeletons";
import {
  readFavoriteRecords,
  type FavoriteRecord,
} from "@/hooks/useFavorites";
import {
  resolveAdDetails,
  type ResolvedAdDetail,
} from "@/lib/ad-detail-cache";
import type { FixtureAd } from "@/data/search-fixtures";

interface ResolvedFavorite {
  record: FavoriteRecord;
  detail: ResolvedAdDetail;
}

/**
 * Real favorites list (navid 2026-10-08, item 6). Favorite records carry
 * real Divar token ids — NOT fixture ids — so each is resolved through
 * /api/ads/[token] (server-cached 60 min). A favorite whose ad is gone
 * (deleted/unavailable) still shows as a row with an honest "unavailable"
 * note instead of silently vanishing.
 *
 * Mental model, enforced here:
 * - HEART on an AD = «علاقه‌مندی» (like) → lands in this list.
 * - BOOKMARK on a HUNT = «ذخیره» (save definition) → ذخیره‌شده‌ها tab.
 * The two verbs never cross.
 */
export function FavoriteAdsList({ onUnfavorite }: { onUnfavorite: (adId: string) => void }) {
  const [records, setRecords] = useState<FavoriteRecord[] | null>(null);
  const [resolved, setResolved] = useState<Map<string, ResolvedFavorite>>(new Map());

  useEffect(() => {
    setRecords(readFavoriteRecords());
  }, []);

  useEffect(() => {
    if (!records) return;
    let cancelled = false;
    const missing = records.filter((r) => !resolved.has(r.adId));
    if (missing.length === 0) return;
    (async () => {
      // Shared cache: if the search sheet (or another view) already resolved
      // these ads, no new requests fire at all.
      const details = await resolveAdDetails(missing.map((r) => r.sourceAdId));
      const next = new Map(resolved);
      for (const r of missing) {
        const d = details.get(r.sourceAdId);
        if (d) next.set(r.adId, { record: r, detail: d });
      }
      if (!cancelled) setResolved(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  if (records === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="در حال بارگذاری">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={28} aria-hidden="true" className="text-muted-foreground" />}
        title="هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌ای"
        description="روی قلب هر آگهی بزن تا اینجا نگه‌ش داری."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {records.map((r) => {
        const res = resolved.get(r.adId);
        if (!res) {
          return (
            <li key={r.adId} aria-busy="true">
              <SkeletonCard />
            </li>
          );
        }
        if (res.detail.failed) {
          return (
            <li
              key={r.adId}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-muted-foreground">
                  این آگهی دیگر در دسترس نیست.
                </span>
              </span>
              <button
                type="button"
                onClick={() => onUnfavorite(r.adId)}
                aria-label="حذف از علاقه‌مندی‌ها"
                className="shrink-0 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                حذف
              </button>
            </li>
          );
        }
        // Adapt the real ad to the row's shape (FixtureAd mirrors DivarAd).
        const ad: FixtureAd = {
          id: r.sourceAdId,
          title: res.detail.title,
          description: "",
          price: res.detail.price,
          priceText: res.detail.priceText,
          city: res.detail.city,
          cityId: "",
          neighborhood: "",
          category: "",
          categoryId: "all",
          images: res.detail.thumbnail ? [res.detail.thumbnail] : [],
          thumbnail: res.detail.thumbnail ?? undefined,
          createdAt: new Date(r.savedAt).toISOString(),
        };
        return (
          <li key={r.adId}>
            <FavoriteRow
              ad={ad}
              from="archive"
              action={
                <button
                  type="button"
                  onClick={() => onUnfavorite(r.adId)}
                  aria-label="حذف از علاقه‌مندی‌ها"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Heart size={18} aria-hidden="true" fill="currentColor" />
                </button>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
