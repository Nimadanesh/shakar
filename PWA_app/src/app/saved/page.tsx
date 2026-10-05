"use client";

import Image from "next/image";
import Link from "next/link";
import { BellRing, Bookmark, Heart } from "lucide-react";
import { CategoryArt } from "@/components/ads/CategoryArt";
import { EmptyState } from "@/components/ui/empty-state";
import { useFavorites } from "@/hooks/useFavorites";
import { SEARCH_FIXTURES, type FixtureAd } from "@/data/search-fixtures";
import { formatPriceToman } from "@/lib/prices";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[15px] font-semibold leading-6 text-foreground">{children}</h2>;
}

function FavoriteRow({ ad }: { ad: FixtureAd }) {
  return (
    <Link
      href={`/ads/${ad.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
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
  );
}

/**
 * Mission control: saved hunts, کمین monitoring, favorites.
 * Favorites read the honest local store. Saved hunts and کمین need
 * identity + backend, so their sections are honest empty states —
 * never fabricated activity.
 */
export default function SavedPage() {
  const { isFavorite } = useFavorites();
  const favoriteAds = SEARCH_FIXTURES.filter((ad) => isFavorite(ad.id));

  return (
    <main className="flex flex-1 flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold leading-8 text-foreground">شکار من</h1>

      <section aria-label="کمین‌ها" className="flex flex-col gap-3">
        <SectionTitle>کمین‌ها</SectionTitle>
        <EmptyState
          icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="کمین فعالی نداری"
          description="برای شکاری که ذخیره کنی کمین می‌ذارم؛ آگهی اوکازیون که اومد خبرت می‌کنم."
        />
      </section>

      <section aria-label="شکارهای ذخیره‌شده" className="flex flex-col gap-3">
        <SectionTitle>شکارهای ذخیره‌شده</SectionTitle>
        <EmptyState
          icon={<Bookmark size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="هنوز شکاری ذخیره نکرده‌ای"
          description="شکار کامل که اجرا کردی، می‌تونی ذخیره‌ش کنی تا بعداً با یک لمس اجراش کنی."
          primaryAction={{ label: "شروع شکار", onClick: () => (window.location.href = "/") }}
        />
      </section>

      <section aria-label="علاقه‌مندی‌ها" className="flex flex-col gap-3">
        <SectionTitle>علاقه‌مندی‌ها</SectionTitle>
        {favoriteAds.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {favoriteAds.map((ad) => (
              <li key={ad.id}>
                <FavoriteRow ad={ad} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Heart size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌ای"
            description="روی آگهی‌های خوب بزن تا اینجا نگه‌شون داری."
          />
        )}
      </section>
    </main>
  );
}
