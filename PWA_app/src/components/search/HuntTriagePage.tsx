"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RadarDialog } from "@/components/search/RadarDialog";
import { ResultsView, type ReadyResult } from "@/components/search/ResultsView";
import { SortSheet } from "@/components/search/SortSheet";
import { StickyHuntBar, type ResultView } from "@/components/search/StickyHuntBar";
import { EmptyState } from "@/components/ui/empty-state";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { useHiddenAds } from "@/hooks/useHiddenAds";
import { requireAuth } from "@/lib/auth";
import { readHunt, type HuntRecord } from "@/lib/hunt-store";
import { interpretQuery } from "@/lib/interpret";
import { buildRadarConfig, type RadarConfig } from "@/lib/radar";
import { runSearch, sortResults, type SortKey } from "@/lib/search";
import { buildEffectiveContext } from "@/lib/search-context";
import { writeParams } from "@/lib/search-params";

const VIEW_STORAGE_KEY = "shakar:result-view:v1";

function readStoredView(): ResultView {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "compact" ? "compact" : "card";
  } catch {
    return "card";
  }
}

interface Computed {
  includeTerms: string[];
  excludeTerms: string[];
  results: ReadyResult[];
  suppressedCount: number;
  query: string;
}

/**
 * Triage of ONE paid, persistent hunt at its canonical URL.
 * The result set is re-derived from the stored hunt record — the exact
 * intent the user paid for, never silently relaxed or re-interpreted.
 */
export function HuntTriagePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [hunt] = useState(() => readHunt(id));
  const [sort, setSort] = useState<SortKey>("best");
  const [view, setView] = useState<ResultView>(readStoredView);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [radar, setRadar] = useState<RadarConfig | null>(null);
  const [radarOpen, setRadarOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const { hiddenIds, hide, unhide } = useHiddenAds();

  const computed: Computed | "error" | null = useMemo(() => {
    if (!hunt) return null;
    try {
      const interp = interpretQuery(hunt.query);
      const ctx = buildEffectiveContext(hunt.query, hunt.base, interp, new Set(hunt.dismissed));
      const prefs = interp.preferences
        .map((p) => p.value)
        .filter((v) => !ctx.includeKeywords.includes(v));
      const outcome = runSearch(ctx, SEARCH_FIXTURES, prefs);
      const adsById = new Map(SEARCH_FIXTURES.map((ad) => [ad.id, ad]));
      const joined: ReadyResult[] = [];
      for (const match of outcome.results) {
        const ad = adsById.get(match.adId);
        if (ad) joined.push({ ad, match });
      }
      return {
        includeTerms: ctx.includeKeywords,
        excludeTerms: ctx.excludeKeywords,
        results: sortResults(joined, sort),
        suppressedCount: outcome.suppressed.length,
        query: hunt.query,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch {
      return "error";
    }
  }, [hunt, sort, retryNonce]);

  if (!hunt) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          title="این شکار پیدا نشد."
          description="ممکن است پاک شده باشد یا نشانی اشتباه باشد."
          primaryAction={{ label: "بازگشت به خانه", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  const record: HuntRecord = hunt;

  const refinementCount =
    record.base.include.length +
    record.base.exclude.length +
    (record.base.city !== "all" ? 1 : 0) +
    (record.base.category !== "all" ? 1 : 0) +
    (record.base.priceMin.trim() !== "" || record.base.priceMax.trim() !== "" ? 1 : 0) +
    (record.base.hasImage ? 1 : 0);

  /** Refine: restore the intent on Home for editing — the re-run stays explicit. */
  function openRefine() {
    router.push(`${writeParams(record.query, record.base)}&setup=1`);
  }

  function handleViewChange(next: ResultView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function handleOpenRadar() {
    const q = record.query.trim();
    if (q === "") return;
    // کمین is a persistent action: guests are routed to auth with the
    // exact hunt stored for resume.
    if (!requireAuth({ type: "radar", query: q, base: record.base }, (url) => router.push(url)))
      return;
    const interp = interpretQuery(q);
    const ctx = buildEffectiveContext(q, record.base, interp, new Set(record.dismissed));
    setRadar(buildRadarConfig(ctx, q));
    setRadarOpen(true);
  }

  const phase =
    computed === null || computed === "error"
      ? "error"
      : computed.results.length === 0
        ? "empty"
        : "ready";

  return (
    <div className="flex flex-col gap-4">
      <StickyHuntBar
        query={hunt.query}
        resultCount={computed !== null && computed !== "error" ? computed.results.length : 0}
        refinementCount={refinementCount}
        sort={sort}
        onOpenSort={() => setSortSheetOpen(true)}
        view={view}
        onViewChange={handleViewChange}
        onOpenPrecision={openRefine}
        onBackToSearch={() => router.push("/")}
      />

      {computed !== null && computed !== "error" && (
        <ResultsView
          phase={phase}
          results={computed.results}
          suppressedCount={computed.suppressedCount}
          includeTerms={computed.includeTerms}
          excludeTerms={computed.excludeTerms}
          view={view}
          hiddenIds={hiddenIds}
          onHide={hide}
          onUnhide={unhide}
          onOpenRadar={handleOpenRadar}
          onOpenPrecision={openRefine}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      )}
      {(computed === null || computed === "error") && (
        <ResultsView
          phase="error"
          results={[]}
          suppressedCount={0}
          includeTerms={[]}
          excludeTerms={[]}
          view={view}
          hiddenIds={[]}
          onHide={() => {}}
          onUnhide={() => {}}
          onOpenRadar={() => {}}
          onOpenPrecision={openRefine}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      )}

      <SortSheet
        open={sortSheetOpen}
        sort={sort}
        onSelect={setSort}
        onClose={() => setSortSheetOpen(false)}
      />

      <RadarDialog open={radarOpen} radar={radar} onClose={() => setRadarOpen(false)} />
    </div>
  );
}
