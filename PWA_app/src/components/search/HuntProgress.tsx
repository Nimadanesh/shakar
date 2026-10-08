"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getCachedResults, setCachedResults } from "@/lib/hunt-results-cache";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, Heart, Repeat, Bookmark, Share2, Check } from "lucide-react";
import type { HuntDefinition, HuntEvent, HuntStats, ScoredAd } from "@/lib/server/hunt/pipeline";
import { fa, pickVariant } from "@/lib/hunt-copy";
import { formatPriceToman } from "@/lib/prices";
import { clearActiveHunt } from "@/lib/active-hunt";
import { warmUsage } from "@/lib/usage";
import { setTaskReturn } from "@/lib/task-return";
import { requireAuth } from "@/lib/auth";
import { armKaminServer, disarmKaminServer } from "@/lib/kamin-client";
import { ensurePushSubscription } from "@/lib/push-client";
import { useGatedFavorites } from "@/hooks/useGatedFavorites";
import { useHiddenAds } from "@/hooks/useHiddenAds";
import { useTaskReturnRestore } from "@/hooks/useTaskReturnRestore";
import { isAdSeen } from "@/lib/seen-ads";
import { writeParams } from "@/lib/search-params";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { isHuntSaved, saveHunt, unsaveHunt } from "@/lib/saved-hunts";
// Closed-by-default dialog: own chunk, never blocks first paint.
const RadarDialog = dynamic(
  () => import("@/components/search/RadarDialog").then((m) => m.RadarDialog),
  { ssr: false }
);
import type { ContextBase } from "@/lib/search-context";
import { cn } from "@/lib/utils";

/**
 * HuntProgress — the "AI is hunting for you" experience (M4a).
 * Subscribes to GET /api/hunts/[id]/stream (SSE) and renders:
 *  1. a live thinking trace (each line = a real pipeline event),
 *  2. confirmed results streaming in 10-by-10 with «تأیید شد»,
 *  3. the done state with the full ranked list.
 *
 * Copy: docs/hunt-progress-copy.md. Sentence variants rotate
 * deterministically, seeded by runId — stable within a hunt.
 */

import { LoaderGrid } from "@/components/ui/LoadingState";

function DotLoading() {
  return <LoaderGrid tone="default" />;
}

const ResultCard = memo(function ResultCard({
  ad,
  index,
  detailHref,
  onHide,
}: {
  ad: ScoredAd;
  index: number;
  detailHref: string;
  onHide: (adId: string) => void;
}) {
  const { isFavorite, toggle } = useGatedFavorites();
  const favorite = isFavorite(ad.sourceAdId);
  // Seen marker: evaluated on mount, so returning from the ad's detail
  // page (which marks it seen) shows "دیده شد" immediately.
  const [seen] = useState(() => isAdSeen(ad.sourceAdId));
  // Per-ad share (navid 2026-10-08, spec B): the result card is where the
  // user decides "this one" — sharing must not wait for the detail page.
  // Shares the ad's own canonical URL, not the hunt page.
  const [copied, setCopied] = useState(false);
  async function handleShare() {
    const url = `${window.location.origin}${detailHref}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: ad.title, url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — leave the button as-is.
    }
  }
  return (
    <article
      className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
    >
      <Link
        href={detailHref}
        onClick={() =>
          setTaskReturn({
            url: window.location.pathname + window.location.search,
            scrollY: window.scrollY,
          })
        }
        className="block focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-6">{ad.title}</h3>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] text-white dark:bg-zinc-100 dark:text-zinc-900">
              تأیید شد
            </span>
            {seen && (
              <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                دیده شد
              </span>
            )}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-zinc-500">
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {ad.price !== null ? formatPriceToman(ad.price) : (ad.priceText ?? "توافقی")}
          </span>
          {ad.city !== "" && <span>{ad.city}</span>}
        </div>
        {ad.evidence.length > 0 && (
          <p className="mt-1 break-words text-xs text-zinc-500">
            چون: {ad.evidence.map((e) => `«${e}»`).join("، ")}
          </p>
        )}
        {ad.detailUnknown === true && (
          <p className="mt-1 text-xs text-zinc-500">جزئیات کامل خوانده نشد</p>
        )}
      </Link>
      <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
        <button
          type="button"
          onClick={() => toggle(ad.sourceAdId)}
          aria-label={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          aria-pressed={favorite}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] transition-colors",
            favorite ? "text-primary" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          )}
        >
          <Heart size={15} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
          {favorite ? "در علاقه‌مندی‌ها" : "علاقه‌مندی"}
        </button>
        <button
          type="button"
          onClick={() => onHide(ad.sourceAdId)}
          aria-label="مخفی کردن این آگهی"
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <EyeOff size={15} aria-hidden="true" />
          مخفی کن
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label="اشتراک‌گذاری این آگهی"
          aria-live="polite"
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {copied ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Share2 size={15} aria-hidden="true" />
          )}
          {copied ? "کپی شد" : "اشتراک‌گذاری"}
        </button>
      </div>
    </article>
  );
});

interface TraceLine {
  id: number;
  text: string;
  done: boolean;
}

export function HuntProgress({ runId, query }: { runId: string; query: string }) {
  const router = useRouter();
  // Quota warm: the loop's «دقیق‌ترش کن» lands on the home hunt form —
  // warm the usage fetch while the hunter reads results so the «شکار کن»
  // button there never flashes enabled for an exhausted quota.
  useEffect(() => {
    warmUsage();
  }, []);
  // Instant-first render: if the completed results are cached (back-nav),
  // initialize directly into the ready state — not even one skeleton frame.
  const initialCached = getCachedResults(runId);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [current, setCurrent] = useState<string>(
    initialCached
      ? initialCached.results.length > 0
        ? `${fa(initialCached.results.length)} شکار دقیق.`
        : "چیزی که دقیقاً بخوره به مشخصاتت پیدا نکردم."
      : "شکار شروع شد — دارم برات می‌گردم."
  );
  const [results, setResults] = useState<ScoredAd[]>(() => initialCached?.results ?? []);
  const [stats, setStats] = useState<HuntStats | null>(() => initialCached?.stats ?? null);
  const [done, setDone] = useState(() => initialCached !== null);
  const [error, setError] = useState<string | null>(null);
  const [deepening, setDeepening] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [showScrollInfo, setShowScrollInfo] = useState(false);
  /** The run's definition (from GET) — powers refine + kamin + detail evidence. */
  const [definition, setDefinition] = useState<HuntDefinition | null>(
    () => initialCached?.definition ?? null
  );
  /** The hunt's title for display: the run's own definition wins over the
      caller-supplied prop (the /results/[runId] page passes ""). Never
      render the «» line when the title is unknown — empty guillemets are
      visual noise (navid 2026-10-08). */
  const displayQuery = definition?.query ?? query;
  /** The loop: «شکار تموم شد، حالا چی؟» — sheet + bottom block share these. */
  const [loopOpen, setLoopOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [kaminId, setKaminId] = useState<string | null>(null);
  const { hiddenIds, hide } = useHiddenAds();
  const [loadState, setLoadState] = useState<"loading" | "live" | "ready" | "expired">(
    () => (initialCached ? "ready" : "loading")
  );
  // Task continuity: returning from an ad's detail or the auth gate
  // restores the exact scroll position of the results list. The restore
  // must not conclude "settled" while results are still loading —
  // on a slow network the skeleton is stable AND short for seconds.
  useTaskReturnRestore(true, loadState === "ready" || loadState === "expired");
  /**
   * Load phase — the results-VIEW contract:
   *  - "loading": checking the run's status;
   *  - "live": run is active → open the SSE stream;
   *  - "ready": run already done → results render directly, no stream,
   *    no replayed "searching" theater, no re-fire;
   *  - "expired": run not found → honest expired view.
   */
  const esRef = useRef<EventSource | null>(null);
  const lineId = useRef(0);
  const seenResults = useRef(new Set<string>());

  function handleStop() {
    esRef.current?.close();
    esRef.current = null;
    setStopped(true);
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowScrollInfo(y > 120);
      setShowTop(y > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function goDeep() {
    if (deepening) return;
    setDeepening(true);
    try {
      const res = await fetch(`/api/hunts/${encodeURIComponent(runId)}/deepen`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { runId?: string };
      } | null;
      const nextId = json?.ok === true ? json.data?.runId : undefined;
      if (typeof nextId === "string" && nextId !== "") {
        router.push(`/hunt/${encodeURIComponent(nextId)}?q=${encodeURIComponent(query)}`);
        return;
      }
    } catch {
      /* fall through */
    }
    setDeepening(false);
  }

  /** HuntDefinition → editable ContextBase (refine + auth-resume). */
  function definitionToBase(def: HuntDefinition): ContextBase {
    return {
      category: def.category,
      city: def.city,
      priceMin: def.priceMin,
      priceMax: def.priceMax,
      include: [...def.include],
      exclude: [...def.exclude],
      hasImage: false,
      transaction: def.transaction,
      condition: def.condition,
    };
  }

  /** The loop, action 1: refine — restore the exact intent on Home for editing. */
  function handleRefine() {
    if (!definition) return;
    setLoopOpen(false);
    router.push(`/${writeParams(definition.query, definitionToBase(definition))}&setup=1`);
  }

  /** The loop, action 2: kamin — the hunt becomes a watcher. Auth-gated. */
  function handleOpenKamin() {
    if (!definition) return;
    setLoopOpen(false);
    const base = definitionToBase(definition);
    const here = window.location.pathname + window.location.search;
    if (
      !requireAuth(
        { type: "radar", query: definition.query, base, huntId: runId },
        (url) => router.push(url),
        here,
        { scrollY: window.scrollY }
      )
    )
      return;
    setRadarOpen(true);
  }

  async function handleArmKamin() {
    if (!definition) return;
    const seenIds = results.map((r) => r.sourceAdId);
    const res = await armKaminServer(definition, definition.query, seenIds);
    if (res.ok) {
      if (res.kamin) setKaminId(res.kamin.id);
      else setKaminId("existing");
      ensurePushSubscription();
    }
    setRadarOpen(false);
  }

  async function handleDisarmKamin() {
    if (kaminId && kaminId !== "existing") {
      await disarmKaminServer(kaminId);
    }
    setKaminId(null);
    setRadarOpen(false);
  }

  /**
   * Evidence query string for /ads/[token] — «چرا این آگهی؟» stays honest.
   * The hunt-level params are identical for every card; build them once
   * (memo) instead of rebuilding per card per render.
   */
  const detailBase = useMemo(() => {
    const p = new URLSearchParams();
    p.set("hunt", runId);
    const q = definition?.query ?? query;
    if (q !== "") p.set("q", q);
    if (definition) {
      for (const t of definition.include) p.append("inc", t);
      for (const t of definition.exclude) p.append("exc", t);
      if (definition.category !== "all") p.set("cat", definition.category);
      if (definition.city !== "all") p.set("city", definition.city);
      if (definition.priceMin !== "") p.set("min", definition.priceMin);
      if (definition.priceMax !== "") p.set("max", definition.priceMax);
    }
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, definition, query]);

  function detailHrefFor(ad: ScoredAd): string {
    // Degraded-view fallback (navid 2026-10-08): if the live detail fetch
    // fails, the ad page can still render the list-known title/price/city
    // instead of a dead page. Truncated to keep URLs sane.
    let extra = "";
    if (ad.title !== "") extra += `&t=${encodeURIComponent(ad.title.slice(0, 120))}`;
    if (ad.price !== null) extra += `&p=${ad.price}`;
    else if (ad.priceText) extra += `&pt=${encodeURIComponent(ad.priceText.slice(0, 40))}`;
    if (ad.city !== "") extra += `&c=${encodeURIComponent(ad.city.slice(0, 40))}`;
    return `/ads/${encodeURIComponent(ad.sourceAdId)}?${detailBase}${extra}`;
  }

  const visibleResults = results.filter((r) => !hiddenIds.includes(r.sourceAdId));
  const loopActionsAvailable = done && definition !== null;
  /** Saved-hunt toggle (navid 2026-10-08): the bookmark next to the loop
      icon. Local-first — guests keep it on this device, logged-in users
      get the server mirror via saveHunt's write-through. */
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (loopActionsAvailable) setSaved(isHuntSaved(displayQuery));
  }, [loopActionsAvailable, displayQuery]);
  function toggleSave() {
    if (definition === null || displayQuery === "") return;
    if (saved) {
      unsaveHunt(displayQuery);
      setSaved(false);
      return;
    }
    const base: ContextBase = {
      category: definition.category,
      city: definition.city,
      priceMin: definition.priceMin,
      priceMax: definition.priceMax,
      include: [...definition.include],
      exclude: [...definition.exclude],
      hasImage: false,
      transaction: definition.transaction,
      condition: definition.condition,
    };
    setSaved(saveHunt(displayQuery, base) !== null);
  }

  const pushTrace = (text: string, isDone: boolean) => {
    lineId.current += 1;
    const id = lineId.current;
    setTrace((t) => [...t.slice(-6), { id, text, done: isDone }]);
  };

  useEffect(() => {
    let cancelled = false;
    // Cache hit = a completed hunt whose results are IMMUTABLE (the cache
    // only stores terminal runs). Re-downloading the full results JSON on
    // every back-nav was pure waste on cellular — skip it entirely.
    // (Initial state is already "ready" from the cache.)
    // No cache → this fetch is the primary load.
    if (initialCached) return;
    fetch(`/api/hunts/${encodeURIComponent(runId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setLoadState("expired");
          clearActiveHunt(runId);
          return;
        }
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: {
            status?: string;
            results?: ScoredAd[];
            stats?: HuntStats;
            definition?: HuntDefinition;
          };
        } | null;
        const data = json?.ok === true ? json.data : undefined;
        if (data?.definition) setDefinition(data.definition);
        if (data && (data.status === "done" || data.status === "failed")) {
          const doneResults = Array.isArray(data.results) ? data.results : [];
          setResults(doneResults);
          if (data.stats) setStats(data.stats);
          setDone(true);
          // The journey, not just "done": when the user opens جزئیات on a
          // completed hunt, they see the work that was done — reconstructed
          // honestly from the persisted stats (navid 2026-10-08).
          const st = data.stats;
          if (st) {
            pushTrace(`${fa(st.adsSeen)} آگهی بررسی شد.`, true);
            pushTrace(`${fa(st.detailsChecked)} جزئیات آگهی خوانده شد.`, true);
          }
          pushTrace(
            doneResults.length > 0
              ? `${fa(doneResults.length)} مورد دقیق تأیید شد.`
              : "مورد دقیقی پیدا نشد.",
            true
          );
          setCurrent(
            doneResults.length > 0
              ? `${fa(doneResults.length)} شکار دقیق.`
              : "چیزی که دقیقاً بخوره به مشخصاتت پیدا نکردم."
          );
          setLoadState("ready");
          clearActiveHunt(runId);
          // Cache the immutable results for instant back-navigation.
          setCachedResults(runId, {
            results: doneResults,
            stats: data.stats ?? null,
            definition: data.definition ?? null,
            query,
          });
        } else {
          setLoadState("live");
        }
      })
      .catch(() => {
        // Offline or fetch failed: fall through to the stream, which will
        // surface its own honest error.
        if (!cancelled) setLoadState("live");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    if (loadState !== "live") return;
    const es = new EventSource(`/api/hunts/${encodeURIComponent(runId)}/stream`);
    esRef.current = es;
    const v = (stage: string, variants: string[]) => pickVariant(runId, stage, variants);

    es.onmessage = (msg) => {
      let e: HuntEvent;
      try {
        e = JSON.parse(msg.data) as HuntEvent;
      } catch {
        return;
      }
      switch (e.type) {
        case "started":
          setCurrent("شکار شروع شد — دارم برات می‌گردم.");
          break;
        case "lists-progress":
          setCurrent(`دارم آگهی‌ها رو جمع می‌کنم... ${fa(e.adsSeen)} تا تا حالا`);
          break;
        case "lists-done":
          pushTrace(`${fa(e.adsSeen)} آگهی پیدا کردم.`, true);
          setCurrent(
            v("filter", [
              "دارم تیترها رو با «باید»ها و «نباید»هات چک می‌کنم...",
              "دارم تیترها رو می‌خونم و با مشخصاتت مقایسه می‌کنم...",
            ])
          );
          break;
        case "ranked":
          pushTrace(
            `${fa(e.scored)} آگهی رو مرور کردم — ${fa(e.shortlisted)} تای مرتبط‌تر رو جدا کردم${e.excluded > 0 ? ` (${fa(e.excluded)} تا با «نباید»هات حذف شد)` : ""}.`,
            true
          );
          setCurrent("حالا دارم توضیحاتشون رو یکی‌یکی می‌خونم...");
          break;
        case "candidates":
          pushTrace(
            `${fa(e.count)} کاندید موندن${e.dupsCollapsed > 0 ? ` (${fa(e.dupsCollapsed)} تکراری حذف شد)` : ""} — حالا دارم توضیحاتشون رو می‌خونم.`,
            true
          );
          setCurrent("این دقیق‌ترین بخش کاره...");
          break;
        case "big-hunt":
          pushTrace(
            `کاندیدها زیادن (${fa(e.candidates)} تا) — اول بهترین‌هاشون رو بررسی می‌کنم.`,
            true
          );
          break;
        case "details-batch": {
          const fresh = e.confirmed.filter((ad) => {
            if (seenResults.current.has(ad.sourceAdId)) return false;
            seenResults.current.add(ad.sourceAdId);
            return true;
          });
          if (fresh.length > 0) setResults((r) => [...r, ...fresh]);
          pushTrace(`${fa(e.checked)} از ${fa(e.total)} بررسی شد.`, true);
          setCurrent(
            fresh.length > 0
              ? "اینا تأیید شدن — می‌تونی شروع کنی. بقیه‌شون دارن بررسی می‌شن."
              : v("detail", [
                  "دارم توضیحات رو می‌خونم...",
                  "دارم جزئیات آگهی‌ها رو با دقت بررسی می‌کنم...",
                ])
          );
          break;
        }
        case "done":
          setStats(e.stats);
          // Merge any stragglers, keep ranked order from the server.
          setResults(e.results);
          setDone(true);
          pushTrace("تموم شد.", true);
          setCurrent(
            e.results.length > 0
              ? `${fa(e.results.length)} شکار دقیق از ${fa(e.stats.adsSeen)} آگهی.`
              : "چیزی که دقیقاً بخوره به مشخصاتت پیدا نکردم."
          );
          es.close();
          clearActiveHunt(runId);
          // Cache the immutable results for instant back-navigation.
          setCachedResults(runId, {
            results: e.results,
            stats: e.stats,
            definition,
            query,
          });
          break;
        case "error":
          setError(
            e.errorClass === "rate-limited"
              ? "فعلاً ترافیک زیاده — چند لحظه دیگه دوباره تلاش کن."
              : "مشکلی پیش اومد — دوباره تلاش کن."
          );
          es.close();
          clearActiveHunt(runId);
          break;
      }
    };
    es.onerror = () => {
      setError("ارتباط قطع شد — صفحه رو رفرش کن.");
      es.close();
    };
    return () => es.close();
  }, [runId, loadState]);

  if (loadState === "loading") {
    return (
      <div className="mx-auto w-full max-w-xl min-w-0 px-3 pb-6 pt-0" aria-busy="true" aria-label="در حال بارگذاری شکار">
        <div aria-hidden="true" className="h-14 animate-pulse rounded-lg bg-secondary" />
        <div aria-hidden="true" className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-secondary" />
          <div className="h-20 animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>
    );
  }

  if (loadState === "expired") {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-16 text-center">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          این شکار منقضی شده یا پیدا نشد.
        </p>
        {displayQuery !== "" && (
          <p className="mt-1 text-[13px] text-zinc-500">«{displayQuery}»</p>
        )}
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-zinc-500">
          نتیجه‌های شکارها برای همیشه نگه داشته نمی‌شن — ولی تعریف شکارت رو داری.
        </p>
        <button
          type="button"
          onClick={() => router.push(displayQuery !== "" ? `/?q=${encodeURIComponent(displayQuery)}` : "/")}
          className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          شکار دوباره
        </button>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="mx-auto max-w-xl px-3 py-16 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
      </div>
    );
  }

  const lastTrace = trace.length > 0 ? trace[trace.length - 1].text : null;

  return (
    <div className="mx-auto w-full max-w-xl min-w-0 overflow-x-clip px-3 pb-6 pt-0">
      {/* Thinking trace — no background, tighter spacing (visual 1+2). */}
      <section aria-live="polite" className="px-1">
        <div className="flex items-center gap-2">
          {!done && !stopped ? (
            <DotLoading />
          ) : (
            <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
          )}
          <p className="min-w-0 flex-1 text-sm font-medium">
            {stopped ? "شکار متوقف شد" : done ? "شکار تموم شد" : "در حال شکار"}
          </p>
          {/* The loop, always in reach: the same «قدم بعدی» actions as the
              bottom block, behind one icon — no 100-item scroll needed. */}
          {loopActionsAvailable && (
            <button
              type="button"
              onClick={() => setLoopOpen(true)}
              aria-label="قدم بعدی — ادامه‌ی شکار"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              <Repeat size={17} aria-hidden="true" />
            </button>
          )}
          {/* Save this hunt (navid 2026-10-08): one tap → Archive ›
              ذخیره‌شده‌ها. Same hunt-level row as the loop icon. */}
          {loopActionsAvailable && (
            <button
              type="button"
              onClick={toggleSave}
              aria-pressed={saved}
              aria-label={saved ? "حذف از ذخیره‌ها" : "ذخیره‌ی این شکار"}
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                saved
                  ? "border-zinc-900 text-primary dark:border-zinc-100"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              }`}
            >
              <Bookmark size={17} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        {/* AI shimmer on the hunt title (visual 4). Hidden while the title
            is unknown — never render empty «». */}
        {displayQuery !== "" && (
          <p
            className={`mt-1 text-[13px] text-zinc-500 ${!done && !stopped ? "animate-pulse" : ""}`}
          >
            «{displayQuery}»
          </p>
        )}

        {/* Agent-style live details:
            - while hunting, only the latest trace line is shown;
            - each new line gently replaces the previous one;
            - the full trace list is hidden unless the user explicitly opens Details;
            - the list is an overlay, so opening it never changes page layout. */}
        <div className="relative mt-2">
          <button
            type="button"
            aria-expanded={traceOpen}
            onClick={() => setTraceOpen((o) => !o)}
            className="relative z-20 flex w-full min-h-7 items-center gap-1.5 rounded-md py-1 pl-1 pr-0 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 transition-transform duration-300"
              style={{ transform: traceOpen ? "rotate(180deg)" : "rotate(0)" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-start">جزئیات</span>
          </button>

          <div
            aria-live="polite"
            className="mt-1 min-h-7 overflow-hidden"
          >
            <p
              key={lastTrace ?? "empty"}
              className="min-h-7 truncate text-[12px] text-zinc-500 animate-[fade-up_240ms_cubic-bezier(0.23,1,0.32,1)] dark:text-zinc-400"
            >
              {lastTrace ?? "در حال آماده‌سازی..."}
            </p>
          </div>

          <div
            aria-hidden={!traceOpen}
            className={
              "absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 " +
              (traceOpen
                ? "visible max-h-52 opacity-100"
                : "pointer-events-none invisible max-h-0 opacity-0")
            }
            style={{
              transition:
                "max-height 220ms cubic-bezier(0.23,1,0.32,1), opacity 160ms ease",
            }}
          >
            <div className="max-h-52 overflow-y-auto overscroll-contain px-3 py-2">
              <ul className="space-y-1">
                {trace.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-400"
                  >
                    <span aria-hidden className="mt-0.5 shrink-0">
                      {l.done ? "✓" : "…"}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{l.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Current status — STABLE GEOMETRY.
            The container has a fixed min-height so changing text never
            resizes the layout. Same structure in all states; only the
            stop button visibility changes. */}
        <div className="mt-2 flex min-h-[2rem] items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm">{current}</p>
          {!done && !stopped && (
            <button
              type="button"
              onClick={handleStop}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-[12px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              توقف
            </button>
          )}
        </div>

      </section>

      {/* Completion summary: appears only after the user starts scrolling.
          Fixed under the app header so it never changes document flow. */}
      {done && stats !== null && (
        <div
          aria-live="polite"
          className={`fixed left-0 right-0 top-[68px] z-20 border-b border-zinc-200/90 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-md transition-all duration-200 dark:border-zinc-800/90 dark:bg-zinc-950/95 ${
            showScrollInfo
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          }`}
        >
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 pr-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                {results.length > 0
                  ? `${fa(results.length)} نتیجه دقیق از ${fa(stats.adsSeen)} آگهی`
                  : `از ${fa(stats.adsSeen)} آگهی، مورد دقیقی پیدا نشد`}
              </p>
              {displayQuery !== "" && (
                <p className="truncate text-[11px] text-zinc-500">«{displayQuery}»</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Streaming confirmed results — each card is tappable (detail),
          favoritable and hideable. */}
      {visibleResults.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">
            {done ? `نتایج (${fa(visibleResults.length)})` : "تأییدشده‌ها — بقیه در راهن"}
          </h2>
          <div className="space-y-3">
            {visibleResults.map((ad, i) => (
              <ResultCard
                key={ad.sourceAdId}
                ad={ad}
                index={i}
                detailHref={detailHrefFor(ad)}
                onHide={hide}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state — rich guidance when nothing matched (not just "not found").
          Shows what was searched, where the funnel lost ads, a smart
          suggestion, and actions to continue right here. */}
      {done && stats !== null && results.length === 0 && (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-medium">چیزی که دقیقاً بخوره به مشخصاتت پیدا نکردم.</h2>
            {displayQuery !== "" && (
              <p className="mt-1 text-[13px] text-zinc-500">«{displayQuery}»</p>
            )}

            {/* Funnel breakdown — where did the ads go? */}
            <div className="mt-3 space-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
              <p>{fa(stats.adsSeen)} آگهی رو بررسی کردم.</p>
              {stats.titleRejected > 0 && (
                <p>
                  {fa(stats.titleRejected)} تا سر تیتر رد شدن.
                </p>
              )}
              {stats.candidates > 0 && (
                <p>
                  {fa(stats.candidates)} تا کاندید بودن ولی توضیحاتشون به قیدها نخورد.
                </p>
              )}
              {stats.nearMiss > 0 && (
                <p>
                  {fa(stats.nearMiss)} تا خیلی نزدیک بودن — یه قیدشون کم داشت.
                </p>
              )}
            </div>

            {/* Smart suggestion based on the bottleneck. */}
            <p className="mt-3 text-[13px] text-zinc-600 dark:text-zinc-400">
              {stats.adsSeen > 0 && stats.titleRejected / stats.adsSeen > 0.7
                ? "فیلتر تیتر خیلی سخت‌گیرانه‌ست — یه کلمه از «باید»ها کم کن یا یه «نباید» رو بردار."
                : stats.candidates > 0
                  ? "کاندید پیدا شد ولی توضیحاتشون کافی نبود — قیدهای دقیق رو شل‌تر کن."
                  : "شاید با قیدهای کمتر یا بازه‌ی قیمتی بازتر نتیجه بگیری."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/?q=${encodeURIComponent(query)}`)}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                ویرایش و تلاش دوباره
              </button>
              {stats.adsSeen > 0 && (
                <button
                  type="button"
                  onClick={goDeep}
                  disabled={deepening}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                >
                  {deepening ? "دارم آماده می‌کنم..." : "برم سراغ قدیمی‌ترها؟"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* The loop — «شکار تموم شد، حالا چی؟» Full block at the end of
          results; the same actions live behind the loop icon up top. */}
      {loopActionsAvailable && stats !== null && (
        <section className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium">قدم بعدی</h2>
          <p className="mt-1 text-[13px] leading-6 text-zinc-500">
            شکارِ امروز تموم شد — حالا می‌تونی ادامه‌ش بدی:
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOpenKamin}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Repeat size={16} aria-hidden="true" />
              کمینش کن — آگهی تازه که اومد خبرم کن
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRefine}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-sm text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
              >
                دقیق‌ترش کن
              </button>
              {stats.adsSeen > 0 && (
                <button
                  type="button"
                  onClick={goDeep}
                  disabled={deepening}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-sm text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
                >
                  {deepening ? "دارم آماده می‌کنم..." : "آگهی‌های قدیمی‌تر"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bottom-left viewed counter (UX 2) — so the user never feels lost.
          Tab bar is ~80px tall; place at 96px to clear it. */}
      {results.length > 0 && (
        <div
          aria-hidden
          className="fixed bottom-24 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-[11px] font-medium text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-400"
        >
          {fa(results.length)}
          {stats ? `/${fa(stats.adsSeen)}` : ""}
        </div>
      )}

      {/* Back-to-top (UX 3) — appears above the counter when scrolled down. */}
      <button
        type="button"
        aria-label="بازگشت به بالا"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-36 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 shadow-sm backdrop-blur transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950/90 ${
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-600 dark:text-zinc-400"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>

      {/* The loop as a sheet — the same «قدم بعدی» actions as the bottom
          block, one tap away from the top of the results. */}
      <BottomSheet
        open={loopOpen}
        onClose={() => setLoopOpen(false)}
        label="قدم بعدی"
        title="شکار تموم شد — حالا چی؟"
        subtitle="ادامه‌ی همین شکار، بدون اینکه از اول شروع کنی."
      >
        <div className="flex flex-col gap-2 px-1 pb-2">
          <button
            type="button"
            onClick={handleOpenKamin}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Repeat size={16} aria-hidden="true" />
            کمینش کن — آگهی تازه که اومد خبرم کن
          </button>
          <button
            type="button"
            onClick={handleRefine}
            className="flex h-12 w-full items-center justify-center rounded-lg border border-zinc-300 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            دقیق‌ترش کن
          </button>
          {/* Save this hunt — the same toggle as the bookmark icon up top,
              labeled exactly like the Archive empty state teaches it. */}
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Bookmark size={16} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
            {saved ? "حذف از ذخیره‌ها" : "ذخیره‌ی این شکار"}
          </button>
          {stats !== null && stats.adsSeen > 0 && (
            <button
              type="button"
              onClick={() => {
                setLoopOpen(false);
                goDeep();
              }}
              disabled={deepening}
              className="flex h-12 w-full items-center justify-center rounded-lg border border-zinc-300 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {deepening ? "دارم آماده می‌کنم..." : "برم سراغ آگهی‌های قدیمی‌تر"}
            </button>
          )}
        </div>
      </BottomSheet>

      <RadarDialog
        open={radarOpen}
        armed={kaminId !== null}
        huntName={definition?.query ?? query}
        constraintCount={
          definition
            ? definition.include.length +
              definition.exclude.length +
              (definition.city !== "all" ? 1 : 0) +
              (definition.category !== "all" ? 1 : 0) +
              (definition.priceMin !== "" || definition.priceMax !== "" ? 1 : 0)
            : 0
        }
        onArm={handleArmKamin}
        onDisarm={handleDisarmKamin}
        onClose={() => setRadarOpen(false)}
      />
    </div>
  );
}
