"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Bookmark, ChevronLeft, Heart, History } from "lucide-react";
import { CategoryArt } from "@/components/ads/CategoryArt";
import { EmptyState } from "@/components/ui/empty-state";
import { useFavorites } from "@/hooks/useFavorites";
import { SEARCH_FIXTURES, type FixtureAd } from "@/data/search-fixtures";
import { formatPriceToman } from "@/lib/prices";
import { cn } from "@/lib/utils";
import {
  disarmKamin,
  kaminCtxToBase,
  kaminNewIds,
  listKamins,
  markKaminSeen,
  type KaminRecord,
} from "@/lib/kamin-store";
import { readHunts, recordHunt, type HuntRecord } from "@/lib/hunt-store";
import { runSearch } from "@/lib/search";

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline gap-1.5 text-[15px] font-semibold leading-6 text-foreground">
      {children}
      {count !== undefined && (
        <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
          ({count.toLocaleString("fa-IR")})
        </span>
      )}
    </h2>
  );
}

function constraintCount(kamin: KaminRecord): number {
  const ctx = kamin.ctx;
  return (
    ctx.includeKeywords.length +
    ctx.excludeKeywords.length +
    (ctx.city !== "all" ? 1 : 0) +
    (ctx.category !== "all" ? 1 : 0) +
    (ctx.priceMin !== null || ctx.priceMax !== null ? 1 : 0) +
    (ctx.hasImage ? 1 : 0)
  );
}

/**
 * One unified layout for fresh and quiet kamins. The primary job is always
 * one tap away («دیدن نتایج» — solid when there are new matches, outline
 * otherwise); disarming is demoted to a quiet text action. Re-running is a
 * new paid hunt, so it stays an explicit button — never a card tap.
 */
function KaminCard({
  kamin,
  newCount,
  onViewResults,
  onDisarm,
}: {
  kamin: KaminRecord;
  newCount: number;
  onViewResults: () => void;
  onDisarm: () => void;
}) {
  const fresh = newCount > 0;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold leading-5 text-foreground">
            «{kamin.name}»
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {constraintCount(kamin).toLocaleString("fa-IR")} فیلتر فعال
            {!fresh && " • زیر نظر"}
          </p>
        </div>
        {fresh && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
            {newCount.toLocaleString("fa-IR")} تازه
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onViewResults}
        className={cn(
          "h-11 w-full rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          fresh
            ? "bg-action-primary text-primary-foreground hover:bg-action-primary-hover active:bg-action-primary-active"
            : "border border-border text-foreground hover:border-border-strong"
        )}
      >
        دیدن نتایج
      </button>
      <button
        type="button"
        onClick={onDisarm}
        className="self-start rounded px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
      >
        غیرفعال کردن
      </button>
    </div>
  );
}

function FavoriteRow({ ad }: { ad: FixtureAd }) {
  return (
    <Link
      href={`/ads/${ad.id}?from=saved`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
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
 * Mission control: the morning inbox first. New matches are honest local
 * diffs (current run minus the seen baseline) — background monitoring and
 * push do not exist yet. Saved hunts still need identity + backend, so
 * that section stays an honest empty state.
 */
export default function SavedPage() {
  const router = useRouter();
  const { isFavorite } = useFavorites();
  const favoriteAds = SEARCH_FIXTURES.filter((ad) => isFavorite(ad.id));

  const [kamins, setKamins] = useState<KaminRecord[]>([]);
  const [hunts, setHunts] = useState<HuntRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setKamins(listKamins());
    setHunts(readHunts());
    setReady(true);
  }, []);

  const newCounts = new Map<string, number>();
  for (const kamin of kamins) {
    newCounts.set(kamin.id, kaminNewIds(kamin, SEARCH_FIXTURES).length);
  }
  const freshKamins = kamins.filter((k) => (newCounts.get(k.id) ?? 0) > 0);
  /** Quiet watchers — kamins already surfaced in تازه‌ها don't repeat here. */
  const quietKamins = kamins.filter((k) => (newCounts.get(k.id) ?? 0) === 0);

  function refresh() {
    setKamins(listKamins());
  }

  function handleDisarm(id: string) {
    disarmKamin(id);
    refresh();
  }

  /** Inbox CTA: re-running is a new paid hunt — the cost label says so. */
  function handleViewResults(kamin: KaminRecord) {
    const ids = runSearch(kamin.ctx, SEARCH_FIXTURES).results.map((r) => r.adId);
    markKaminSeen(kamin.id, ids);
    const record = recordHunt(kamin.name, kaminCtxToBase(kamin.ctx), []);
    refresh();
    if (record) router.push(`/hunt/${record.id}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-8 py-6">
      <h1 className="text-xl font-semibold leading-8 text-foreground">شکار من</h1>

      <section aria-label="تازه‌ها" className="flex flex-col gap-3">
        <SectionTitle>تازه‌ها</SectionTitle>
        {!ready ? null : kamins.length === 0 ? (
          <EmptyState
            icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="کمین فعالی نداری"
            description="برای شکاری که اجرا کردی کمین بذار؛ آگهی تازه که اومد اینجا می‌بینی."
            primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
          />
        ) : freshKamins.length === 0 ? (
          <EmptyState
            icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="چیز تازه‌ای نیست"
            description="کمین‌های فعالت زیر نظرن؛ آگهی جدید که بیاد اینجا می‌بینی."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {freshKamins.map((kamin) => (
              <li key={kamin.id}>
                <KaminCard
                  kamin={kamin}
                  newCount={newCounts.get(kamin.id) ?? 0}
                  onViewResults={() => handleViewResults(kamin)}
                  onDisarm={() => handleDisarm(kamin.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {quietKamins.length > 0 && (
        <section aria-label="کمین‌ها" className="flex flex-col gap-3">
          <SectionTitle count={quietKamins.length}>کمین‌ها</SectionTitle>
          <ul className="flex flex-col gap-2">
            {quietKamins.map((kamin) => (
              <li key={kamin.id}>
                <KaminCard
                  kamin={kamin}
                  newCount={newCounts.get(kamin.id) ?? 0}
                  onViewResults={() => handleViewResults(kamin)}
                  onDisarm={() => handleDisarm(kamin.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {hunts.length > 0 && (
        <section aria-label="تاریخچه‌ی شکارها" className="flex flex-col gap-3">
          <SectionTitle count={hunts.length}>تاریخچه‌ی شکارها</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {hunts.map((hunt) => (
              <li key={hunt.id}>
                <Link
                  href={`/hunt/${hunt.id}`}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <History size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {hunt.query}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {new Date(hunt.ts).toLocaleDateString("fa-IR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <ChevronLeft size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="شکارهای ذخیره‌شده" className="flex flex-col gap-3">
        <SectionTitle>شکارهای ذخیره‌شده</SectionTitle>
        <EmptyState
          icon={<Bookmark size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="هنوز شکاری ذخیره نکرده‌ای"
          description="شکار کامل که اجرا کردی، می‌تونی ذخیره‌ش کنی تا بعداً با یک لمس اجراش کنی."
          primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
        />
      </section>

      <section aria-label="علاقه‌مندی‌ها" className="flex flex-col gap-3">
        <SectionTitle count={favoriteAds.length}>علاقه‌مندی‌ها</SectionTitle>
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
