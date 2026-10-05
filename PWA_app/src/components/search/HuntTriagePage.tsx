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
import {
  armKamin,
  disarmKamin,
  findKamin,
  type KaminRecord,
} from "@/lib/kamin-store";
import { interpretQuery } from "@/lib/interpret";
import { normalizePersian } from "@/lib/normalizePersian";
import {
  displayTerms,
  queryContentTerms,
  runSearch,
  sortResults,
  type SortKey,
} from "@/lib/search";
import { buildEffectiveContext } from "@/lib/search-context";
import { writeParams } from "@/lib/search-params";
import type { SearchContext } from "@/types/search";

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
  ctx: SearchContext;
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
  const [radarOpen, setRadarOpen] = useState(false);
  const [kaminTick, setKaminTick] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const { hiddenIds, hide, unhide } = useHiddenAds();

  const computed: Computed | "error" | null = useMemo(() => {
    if (!hunt) return null;
    try {
      const interp = interpretQuery(hunt.query);
      const ctx = buildEffectiveContext(hunt.query, hunt.base, interp, new Set(hunt.dismissed));
      // The form has no preferences channel — only explicit + inferred readings.
      const outcome = runSearch(ctx, SEARCH_FIXTURES, []);
      const adsById = new Map(SEARCH_FIXTURES.map((ad) => [ad.id, ad]));
      const joined: ReadyResult[] = [];
      for (const match of outcome.results) {
        const ad = adsById.get(match.adId);
        if (ad) joined.push({ ad, match });
      }
      return {
        ctx,
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

  /**
   * Evidence context for the ad detail page, carried statelessly in the card
   * links: the hunt's exact terms + its id for back-navigation. The detail
   * page renders «چرا این آگهی؟» from this — never re-interpreted.
   */
  const detailQuery = useMemo(() => {
    if (computed === null || computed === "error") return "";
    const p = new URLSearchParams();
    p.set("hunt", id);
    if (computed.query !== "") p.set("q", computed.query);
    // Effective include terms = explicit chips + the query words the form
    // auto-includes (HuntSetup says so). This is exactly what runSearch
    // matched on, so the detail page's «چرا این آگهی؟» stays honest.
    // Query words consumed by an exclude phrase («دیجیتال» inside the
    // interpreted «پیانو دیجیتال» exclude) are dropped: they are exclusion
    // intent, not positive evidence.
    const effectiveInclude = [...computed.includeTerms];
    const queryTerms = queryContentTerms(computed.query, computed.excludeTerms);
    const displayQueryTerms = displayTerms(computed.query, queryTerms);
    const excludeWords = new Set(
      computed.excludeTerms.flatMap((t) => normalizePersian(t).split(/\s+/))
    );
    queryTerms.forEach((normalized, i) => {
      const display = displayQueryTerms[i];
      if (!excludeWords.has(normalized) && !effectiveInclude.includes(display)) {
        effectiveInclude.push(display);
      }
    });
    for (const term of effectiveInclude) p.append("inc", term);
    for (const term of computed.excludeTerms) p.append("exc", term);
    if (computed.ctx.category !== "all") p.set("cat", computed.ctx.category);
    if (computed.ctx.city !== "all") p.set("city", computed.ctx.city);
    if (computed.ctx.priceMin !== null) p.set("min", String(computed.ctx.priceMin));
    if (computed.ctx.priceMax !== null) p.set("max", String(computed.ctx.priceMax));
    return p.toString();
  }, [computed, id]);

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
    // کمین is a persistent action: guests are routed to auth, then resume
    // on this exact hunt page.
    if (
      !requireAuth({ type: "radar", query: q, base: record.base, huntId: id }, (url) =>
        router.push(url)
      )
    )
      return;
    setRadarOpen(true);
  }

  const kamin: KaminRecord | null = useMemo(() => {
    if (!computed || computed === "error") return null;
    return findKamin(computed.ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, kaminTick]);

  const constraintCount = useMemo(() => {
    if (!computed || computed === "error") return 0;
    const ctx = computed.ctx;
    return (
      ctx.includeKeywords.length +
      ctx.excludeKeywords.length +
      (ctx.city !== "all" ? 1 : 0) +
      (ctx.category !== "all" ? 1 : 0) +
      (ctx.priceMin !== null || ctx.priceMax !== null ? 1 : 0) +
      (ctx.hasImage ? 1 : 0)
    );
  }, [computed]);

  function handleArmKamin() {
    if (!computed || computed === "error") return;
    armKamin(
      computed.ctx,
      record.query,
      computed.results.map((r) => r.ad.id)
    );
    setKaminTick((n) => n + 1);
    setRadarOpen(false);
  }

  function handleDisarmKamin() {
    if (kamin) disarmKamin(kamin.id);
    setKaminTick((n) => n + 1);
    setRadarOpen(false);
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
          detailQuery={detailQuery}
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
          detailQuery={detailQuery}
        />
      )}

      <SortSheet
        open={sortSheetOpen}
        sort={sort}
        onSelect={setSort}
        onClose={() => setSortSheetOpen(false)}
      />

      <RadarDialog
        open={radarOpen}
        armed={kamin !== null}
        huntName={record.query}
        constraintCount={constraintCount}
        onArm={handleArmKamin}
        onDisarm={handleDisarmKamin}
        onClose={() => setRadarOpen(false)}
      />
    </div>
  );
}
