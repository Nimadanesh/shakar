import { Check, Plus, Radar, RotateCcw } from "lucide-react";
import { AdCard } from "@/components/ads/AdCard";
import { AdCardCompact } from "@/components/ads/AdCardCompact";
import { EmptyState } from "@/components/ui/empty-state";
import { NoticeBar } from "@/components/ui/notice-bar";
import type { FixtureAd } from "@/data/search-fixtures";
import type { MatchResult } from "@/types/search";
import type { ResultView } from "@/components/search/StickyHuntBar";

export interface ReadyResult {
  ad: FixtureAd;
  match: MatchResult;
}

interface ResultsViewProps {
  phase: "loading" | "ready" | "empty" | "error";
  results: ReadyResult[];
  suppressedCount: number;
  includeTerms: string[];
  excludeTerms: string[];
  view: ResultView;
  hiddenIds: string[];
  onHide: (adId: string) => void;
  onUnhide: (adId: string) => void;
  onOpenRadar: () => void;
  onOpenPrecision: () => void;
  onRetry: () => void;
  /** Prebuilt query string carrying the hunt's evidence context to /ads/[id]. */
  detailQuery?: string;
  /** Hunt-level save (ذخیره‌ی شکار) — distinct from per-ad favorites. */
  huntSaved: boolean;
  onToggleHuntSave: () => void;
}

/**
 * Quiet hunt-level save action. Labeled in words on purpose: an icon-only
 * bookmark here reads as "bookmark one of these ads", which is what the
 * per-ad heart already does. This saves the whole hunt definition.
 */
function SaveHuntButton({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? "حذف از شکارهای ذخیره‌شده" : "ذخیره‌ی این شکار"}
      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-ring text-muted-foreground hover:text-foreground"
    >
      {saved ? (
        <Check size={14} aria-hidden="true" className="text-primary" />
      ) : (
        <Plus size={14} aria-hidden="true" />
      )}
      {saved ? "ذخیره شد" : "ذخیره‌ی این شکار"}
    </button>
  );
}

export function SkeletonList() {
  return (
    <div className="flex flex-col gap-3 sm:gap-4" aria-busy="true" aria-label="در حال دریافت نتایج">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="aspect-[16/10] w-full animate-pulse bg-secondary" />
          <div className="flex flex-col gap-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded-md bg-secondary" />
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-secondary" />
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultsView({
  phase,
  results,
  suppressedCount,
  includeTerms,
  excludeTerms,
  view,
  hiddenIds,
  onHide,
  onUnhide,
  onOpenRadar,
  onOpenPrecision,
  onRetry,
  detailQuery = "",
  huntSaved,
  onToggleHuntSave,
}: ResultsViewProps) {
  if (phase === "loading") return <SkeletonList />;

  if (phase === "error") {
    return (
      <EmptyState
        title="دریافت نتایج با مشکل مواجه شد."
        description="شکار شما حفظ شده است."
        primaryAction={{ label: "تلاش دوباره", onClick: onRetry }}
      />
    );
  }

  if (phase === "empty") {
    return (
      <EmptyState
        title="با این شرایط نتیجه‌ای پیدا نشد."
        description="شکار فردا هم ادامه دارد — همین شکار را نگه دار یا دقیق‌ترش کن."
        primaryAction={{ label: "کمین بذار، خبرم کن", onClick: onOpenRadar }}
        secondaryAction={{ label: "شکار دقیق رو باز کن", onClick: onOpenPrecision }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <button
        type="button"
        onClick={onOpenRadar}
        className="animate-kamin-border flex h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Radar size={16} aria-hidden="true" />
        کمین بذار، خبرم کن
      </button>
      <SaveHuntButton saved={huntSaved} onToggle={onToggleHuntSave} />
      {suppressedCount > 0 && (
        <NoticeBar>
          {suppressedCount.toLocaleString("fa-IR")} مورد مخفی‌شده کنار گذاشته شد
        </NoticeBar>
      )}
      {results.map(({ ad, match }, index) =>
        hiddenIds.includes(ad.id) ? (
          <NoticeBar
            key={ad.id}
            icon={<RotateCcw size={14} aria-hidden="true" className="shrink-0" />}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">مخفی شد: {ad.title}</span>
              <button
                type="button"
                onClick={() => onUnhide(ad.id)}
                className="flex min-h-8 shrink-0 items-center rounded-full px-2 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                بازگردانی
              </button>
            </span>
          </NoticeBar>
        ) : view === "compact" ? (
          <AdCardCompact
            key={ad.id}
            ad={ad}
            strongMatch={match.strongMatch}
            includeTerms={includeTerms}
            onHide={onHide}
            index={index}
            detailQuery={detailQuery}
          />
        ) : (
          <AdCard
            key={ad.id}
            ad={ad}
            match={match}
            includeTerms={includeTerms}
            excludeTerms={excludeTerms}
            onHide={onHide}
            index={index}
            detailQuery={detailQuery}
          />
        )
      )}
    </div>
  );
}
