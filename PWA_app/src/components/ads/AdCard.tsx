import Image from "next/image";
import Link from "next/link";
import { EyeOff, Heart, Sparkles } from "lucide-react";
import { CategoryArt } from "@/components/ads/CategoryArt";
import { useGatedFavorites } from "@/hooks/useGatedFavorites";
import { excerptSegments, explainWhy } from "@/lib/search";
import { formatPriceToman } from "@/lib/prices";
import { cn } from "@/lib/utils";
import type { FixtureAd } from "@/data/search-fixtures";
import type { MatchResult } from "@/types/search";
import { useState } from "react";

interface AdCardProps {
  ad: FixtureAd;
  match: MatchResult;
  includeTerms: string[];
  excludeTerms: string[];
  onHide: (adId: string) => void;
  /** Card entrance stagger index (60ms steps). */
  index?: number;
}

function FavoriteToggle({ adId, overlay }: { adId: string; overlay?: boolean }) {
  const { isFavorite, toggle } = useGatedFavorites();
  const favorite = isFavorite(adId);
  return (
    <button
      type="button"
      aria-label={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      aria-pressed={favorite}
      onClick={() => toggle(adId)}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.97]",
        overlay && "absolute start-2 top-2 border-white/15 bg-black/35 backdrop-blur-md",
        !overlay && "border-border",
        favorite ? "text-primary" : overlay ? "text-white" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Heart size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
    </button>
  );
}

/** Triage card: image → title → price → evidence → signal → meta → actions. */
export function AdCard({ ad, match, includeTerms, excludeTerms, onHide, index = 0 }: AdCardProps) {
  const segments = excerptSegments(ad.description, includeTerms);
  const unknowns = match.evidence.filter((e) => e.status === "unknown");
  const explanation = explainWhy(ad, includeTerms, excludeTerms);
  const [whyOpen, setWhyOpen] = useState(false);
  const primarySignal = match.strongMatch
    ? "تطابق بالا"
    : (match.reasons[0]?.text ?? null);

  return (
    <article
      className="animate-rise flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-strong"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative">
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
          <CategoryArt categoryId={ad.categoryId} title={ad.title} />
        )}
        <FavoriteToggle adId={ad.id} overlay />
      </div>

      <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/ads/${ad.id}`}
          className="line-clamp-1 text-base font-semibold leading-6 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {ad.title}
        </Link>
        <p className="text-xl font-bold leading-8 tabular-nums text-foreground" dir="auto">
          {formatPriceToman(ad.price)}
        </p>
      </div>

      {(primarySignal || unknowns.length > 0) && (
        <div className="flex flex-col items-start gap-1.5">
          {primarySignal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-signal-soft px-2.5 py-1 text-xs font-medium leading-4 text-signal">
              <span aria-hidden="true">✓</span>
              {primarySignal}
            </span>
          )}
          {unknowns.slice(0, 1).map((u) => (
            <p key={u.term} className="text-[13px] leading-5 text-warning">
              <span aria-hidden="true">؟ </span>
              {u.term} مشخص نیست
            </p>
          ))}
        </div>
      )}

      {ad.description.trim() !== "" && (
        <p className="line-clamp-2 text-[13.5px] leading-6 text-muted-foreground">
          {segments.map((segment, segmentIndex) =>
            segment.hit ? (
              <span key={segmentIndex} className="font-medium text-signal">
                {segment.text}
              </span>
            ) : (
              <span key={segmentIndex}>{segment.text}</span>
            )
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs leading-5 text-muted-foreground">
          {ad.city}
          {ad.neighborhood ? `، ${ad.neighborhood}` : ""} -{" "}
          <span className="font-medium text-muted-foreground">{ad.createdAt}</span>
        </p>
        <button
          type="button"
          onClick={() => onHide(ad.id)}
          aria-label={`مخفی کردن آگهی ${ad.title}`}
          className="flex min-h-8 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <EyeOff size={14} aria-hidden="true" />
          مخفی کن
        </button>
      </div>

      {explanation && (
        <div className="border-t border-border-subtle pt-2">
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
            className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-primary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Sparkles size={14} aria-hidden="true" />
            چرا این آگهی؟
          </button>
          {whyOpen && (
            <p className="animate-rise pt-1 text-[13px] leading-6 text-muted-foreground">
              {explanation.sentence}
            </p>
          )}
        </div>
      )}
      </div>
    </article>
  );
}
