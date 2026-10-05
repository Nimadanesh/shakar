import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CategoryArt } from "@/components/ads/CategoryArt";
import { formatPriceToman } from "@/lib/prices";
import type { FixtureAd } from "@/data/search-fixtures";

/**
 * Favorite row: thumbnail → title → price → location. One tap to detail.
 * Optional `action` (e.g. unfavorite) renders as a trailing icon button —
 * kept outside the link so nested interactivity stays valid.
 */
export function FavoriteRow({
  ad,
  from,
  action,
}: {
  ad: FixtureAd;
  from?: string;
  action?: ReactNode;
}) {
  const href = from ? `/ads/${ad.id}?from=${from}` : `/ads/${ad.id}`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card transition-colors hover:border-ring focus-within:border-ring">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="relative block size-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {ad.thumbnail ? (
            <Image
              src={ad.thumbnail}
              alt=""
              width={128}
              height={128}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <CategoryArt categoryId={ad.categoryId} title={ad.title} className="aspect-square" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold leading-5 text-foreground">
            {ad.title}
          </span>
          <span className="text-[13px] font-semibold tabular-nums leading-5 text-foreground">
            {formatPriceToman(ad.price)}
          </span>
          <span className="text-xs leading-4 text-muted-foreground">
            {ad.city}
            {ad.neighborhood ? `، ${ad.neighborhood}` : ""}
          </span>
        </span>
      </Link>
      {action}
    </div>
  );
}
