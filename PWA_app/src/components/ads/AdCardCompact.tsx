import Image from "next/image";
import Link from "next/link";
import { EyeOff, Heart } from "lucide-react";
import { CategoryArt } from "@/components/ads/CategoryArt";
import { useGatedFavorites } from "@/hooks/useGatedFavorites";
import { excerptSegments } from "@/lib/search";
import { formatPriceToman } from "@/lib/prices";
import { cn } from "@/lib/utils";
import type { FixtureAd } from "@/data/search-fixtures";

interface AdCardCompactProps {
  ad: FixtureAd;
  strongMatch: boolean;
  includeTerms: string[];
  onHide: (adId: string) => void;
  /** Card entrance stagger index (60ms steps). */
  index?: number;
}

/** Dense triage row: same hierarchy as AdCard, one evidence line, no decoration. */
export function AdCardCompact({ ad, strongMatch, includeTerms, onHide, index = 0 }: AdCardCompactProps) {
  const { isFavorite, toggle } = useGatedFavorites();
  const favorite = isFavorite(ad.id);
  const segments = excerptSegments(`${ad.title}. ${ad.description}`, includeTerms);
  const evidence = segments
    .map((s) => s.text)
    .join("")
    .replace(/…/g, "")
    .trim()
    .slice(0, 90);

  return (
    <article
      className="animate-rise flex items-center gap-3 rounded-xl border border-border bg-card p-3"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link
        href={`/ads/${ad.id}`}
        aria-label={ad.title}
        className="relative block size-16 shrink-0 overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
      >
        {ad.thumbnail ? (
          <Image
            src={ad.thumbnail}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <CategoryArt categoryId={ad.categoryId} title={ad.title} className="aspect-square" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/ads/${ad.id}`}
          className="truncate text-sm font-medium leading-5 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {ad.title}
        </Link>
        <p className="text-sm font-semibold leading-5 tabular-nums text-foreground" dir="auto">
          {formatPriceToman(ad.price)}
        </p>
        {evidence !== "" && (
          <p className="truncate text-xs leading-4 text-muted-foreground">{evidence}</p>
        )}
        <p className="truncate text-xs leading-4 text-muted-foreground">
          {ad.city} - {ad.createdAt}
          {strongMatch && <span className="ms-1.5 text-signal">تطابق بالا</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          aria-label={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          aria-pressed={favorite}
          onClick={() => toggle(ad.id)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            favorite ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Heart size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={() => onHide(ad.id)}
          aria-label={`مخفی کردن آگهی ${ad.title}`}
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <EyeOff size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
