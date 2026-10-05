"use client";

import { ArrowDownUp, ArrowRight, Crosshair, LayoutGrid, Rows3 } from "lucide-react";
import type { SortKey } from "@/lib/search";
import { cn } from "@/lib/utils";

export type ResultView = "card" | "compact";

const SORT_SHORT_LABEL: Record<SortKey, string> = {
  best: "تطابق",
  cheap: "ارزان‌ترین",
  pricey: "گران‌ترین",
};

interface StickyHuntBarProps {
  query: string;
  resultCount: number;
  refinementCount: number;
  sort: SortKey;
  onOpenSort: () => void;
  view: ResultView;
  onViewChange: (view: ResultView) => void;
  onOpenPrecision: () => void;
  onBackToSearch: () => void;
}

/**
 * One compact sticky hunt context: back to search, truncated query with the
 * real result count, precision entry with refinement badge, sort and view.
 * Single row, no form — the query itself lives in the input above.
 */
export function StickyHuntBar({
  query,
  resultCount,
  refinementCount,
  sort,
  onOpenSort,
  view,
  onViewChange,
  onOpenPrecision,
  onBackToSearch,
}: StickyHuntBarProps) {
  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-border-subtle bg-background/90 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-screen-sm items-center gap-1.5">
        <button
          type="button"
          onClick={onBackToSearch}
          aria-label="بازگشت به جستجو"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-foreground">
          {query}
          <span className="ms-1.5 font-normal tabular-nums text-muted-foreground">
            • {resultCount.toLocaleString("fa-IR")} نتیجه
          </span>
        </p>
        <button
          type="button"
          onClick={onOpenPrecision}
          aria-label={`شکار دقیق${refinementCount > 0 ? `، ${refinementCount.toLocaleString("fa-IR")} فیلتر فعال` : ""}`}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Crosshair size={20} aria-hidden="true" />
          {refinementCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold leading-4 tabular-nums text-primary"
            >
              {refinementCount.toLocaleString("fa-IR")}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenSort}
          aria-label={`مرتب‌سازی: ${SORT_SHORT_LABEL[sort]}`}
          className="flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowDownUp size={16} aria-hidden="true" />
          {SORT_SHORT_LABEL[sort]}
        </button>
        <button
          type="button"
          onClick={() => onViewChange(view === "card" ? "compact" : "card")}
          aria-label={view === "card" ? "نمای فشرده" : "نمای کارت"}
          aria-pressed={view === "compact"}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            view === "compact"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {view === "card" ? (
            <Rows3 size={20} aria-hidden="true" />
          ) : (
            <LayoutGrid size={20} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
