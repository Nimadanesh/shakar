import Image from "next/image";
import Link from "next/link";
import { Heart, ImageOff, Share2 } from "lucide-react";
import { ShekarScoreBadge } from "@/components/ads/ShekarScoreBadge";
import { cn } from "@/lib/utils";
import type { ShekarAd } from "@/types/ads";

const tagLabels: Record<string, string> = {
  "high-match": "تطابق بالا",
  "good-price": "قیمت خوب",
  new: "جدید",
};

interface AdCardProps {
  ad: ShekarAd;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
  onShare?: (adId: string) => void;
}

export function AdCard({ ad, isFavorite = false, onToggleFavorite, onShare }: AdCardProps) {
  const priceText =
    ad.price === null || ad.price === undefined
      ? "توافقی"
      : `${ad.price.toLocaleString("fa-IR")} تومان`;

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="relative overflow-hidden rounded-xl">
        {ad.thumbnail ? (
          <Image
            src={ad.thumbnail}
            alt={ad.title}
            width={640}
            height={400}
            sizes="(max-width: 640px) 100vw, 640px"
            className="aspect-[16/10] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-muted-foreground">
            <ImageOff size={28} aria-hidden="true" />
          </div>
        )}
        <div className="absolute start-2 top-2 flex gap-1.5">
          <button
            type="button"
            aria-label={isFavorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite?.(ad.id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-ring active:scale-95",
              isFavorite && "text-primary"
            )}
          >
            <Heart size={18} aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            aria-label="اشتراک‌گذاری"
            onClick={() => onShare?.(ad.id)}
            className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-ring active:scale-95"
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Link
        href={`/ads/${ad.id}`}
        className="line-clamp-1 text-sm font-medium leading-6 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {ad.title}
      </Link>
      <p className="text-sm font-bold leading-6">{priceText}</p>
      <p className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">{ad.description}</p>

      <div className="flex items-center gap-1.5">
        <ShekarScoreBadge score={ad.shekarScore} />
        {ad.smartTags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className={cn(
              "rounded-full bg-muted px-2.5 py-1 text-[11px] leading-4 text-muted-foreground",
              tag === "high-match" && "bg-primary/15 text-primary"
            )}
          >
            {tagLabels[tag] ?? tag}
          </span>
        ))}
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        {ad.city}
        {ad.neighborhood ? `، ${ad.neighborhood}` : ""} • {ad.createdAt}
      </p>
    </article>
  );
}
