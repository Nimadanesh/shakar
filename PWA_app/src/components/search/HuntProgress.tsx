"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HuntEvent, HuntStats, ScoredAd } from "@/lib/server/hunt/pipeline";
import { fa, pickVariant } from "@/lib/hunt-copy";
import { formatPriceToman } from "@/lib/prices";

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

function ResultCard({ ad, index }: { ad: ScoredAd; index: number }) {
  return (
    <article
      className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-6">{ad.title}</h3>
        <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] text-white dark:bg-zinc-100 dark:text-zinc-900">
          تأیید شد
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-zinc-500">
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {formatPriceToman(ad.price)}
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
    </article>
  );
}

interface TraceLine {
  id: number;
  text: string;
  done: boolean;
}

export function HuntProgress({ runId, query }: { runId: string; query: string }) {
  const router = useRouter();
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [current, setCurrent] = useState<string>("شکار شروع شد — دارم برات می‌گردم.");
  const [results, setResults] = useState<ScoredAd[]>([]);
  const [stats, setStats] = useState<HuntStats | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepening, setDeepening] = useState(false);
  const [traceOpen, setTraceOpen] = useState(true);
  const [stopped, setStopped] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [showTop, setShowTop] = useState(false);
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
      setShowSticky(y > 240);
      setShowTop(y > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-collapse the trace right before the first results stream in —
  // the user can reopen it anytime.
  useEffect(() => {
    if (results.length > 0 && traceOpen) {
      const t = setTimeout(() => setTraceOpen(false), 800);
      return () => clearTimeout(t);
    }
  }, [results.length]);

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

  const pushTrace = (text: string, isDone: boolean) => {
    lineId.current += 1;
    const id = lineId.current;
    setTrace((t) => [...t.slice(-6), { id, text, done: isDone }]);
  };

  useEffect(() => {
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
          break;
        case "error":
          setError(
            e.errorClass === "rate-limited"
              ? "فعلاً ترافیک زیاده — چند لحظه دیگه دوباره تلاش کن."
              : "مشکلی پیش اومد — دوباره تلاش کن."
          );
          es.close();
          break;
      }
    };
    es.onerror = () => {
      setError("ارتباط قطع شد — صفحه رو رفرش کن.");
      es.close();
    };
    return () => es.close();
  }, [runId]);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-xl px-3 py-16 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
      </div>
    );
  }

  const lastTrace = trace.length > 0 ? trace[trace.length - 1].text : null;

  return (
    <div className="mx-auto max-w-xl px-3 pb-6 pt-4">
      {/* Sticky status bar — fixed below the app header on scroll so the
          user never loses context. Header is 68px (pt-3=12 + h-14=56),
          so this sits at top-[68px] without overlapping. */}
      <div
        aria-hidden={!showSticky}
        className={`fixed inset-x-0 top-[68px] z-30 border-b border-zinc-200 bg-white/90 px-3 py-2 backdrop-blur transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-950/90 ${
          showSticky ? "translate-y-0" : "pointer-events-none -translate-y-full"
        }`}
      >
        <p className="mx-auto max-w-xl text-center text-[13px] tabular-nums text-zinc-600 dark:text-zinc-400">
          {!done
            ? `در حال بررسی ${stats ? `${fa(results.length)}/${fa(stats.adsSeen)}` : "..."}`
            : `${fa(results.length)} نتیجه`}
        </p>
      </div>

      {/* Thinking trace — no background, tighter spacing (visual 1+2). */}
      <section aria-live="polite" className="px-1">
        <div className="flex items-center gap-2">
          {!done && !stopped ? (
            <DotLoading />
          ) : (
            <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
          )}
          <p className="text-sm font-medium">
            {stopped ? "شکار متوقف شد" : done ? "شکار تموم شد" : "در حال شکار"}
          </p>
        </div>
        {/* AI shimmer on the hunt title (visual 4). */}
        {!done && !stopped ? (
          <p
            className="mt-1 bg-clip-text text-[13px] text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--color-zinc-500) 35%, var(--color-zinc-900) 50%, var(--color-zinc-500) 65%)",
              backgroundSize: "200% 100%",
              animation: "shimmer-text 1.8s linear infinite",
            }}
          >
            «{query}»
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-zinc-500">«{query}»</p>
        )}

        {/* Collapsible trace — starts open, staggers in, auto-collapses
            before results stream (visual 6, Thinking pattern).
            Fixed layout: tabular-nums + full width so numbers don't shift. */}
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={traceOpen}
            onClick={() => setTraceOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[12px] tabular-nums text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
              className="transition-transform duration-300"
              style={{ transform: traceOpen ? "rotate(180deg)" : "rotate(0)" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            {traceOpen ? "بستن جزئیات" : lastTrace ?? "جزئیات"}
          </button>
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300"
            style={{
              gridTemplateRows: traceOpen ? "1fr" : "0fr",
              opacity: traceOpen ? 1 : 0,
            }}
          >
            <div className="overflow-hidden">
              <ul className="space-y-1 py-1">
                {trace.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-400"
                    style={{
                      animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both",
                      animationDelay: `${i * 90}ms`,
                    }}
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

        {/* Current status — single line + stop button (visual 7). */}
        {!done && !stopped && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm">{current}</p>
            <button
              type="button"
              onClick={handleStop}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-[12px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              توقف
            </button>
          </div>
        )}
        {(done || stopped) && stats !== null && (
          <p className="mt-2 text-sm">{current}</p>
        )}
      </section>

      {/* Streaming confirmed results */}
      {results.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">
            {done ? `نتایج (${fa(results.length)})` : "تأییدشده‌ها — بقیه در راهن"}
          </h2>
          <div className="space-y-3">
            {results.map((ad, i) => (
              <ResultCard key={ad.sourceAdId} ad={ad} index={i} />
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
            <p className="mt-1 text-[13px] text-zinc-500">«{query}»</p>

            {/* Funnel breakdown — where did the ads go? */}
            <div className="mt-3 space-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
              <p className="tabular-nums">{fa(stats.adsSeen)} آگهی رو بررسی کردم.</p>
              {stats.titleRejected > 0 && (
                <p className="tabular-nums">
                  {fa(stats.titleRejected)} تا سر تیتر رد شدن.
                </p>
              )}
              {stats.candidates > 0 && (
                <p className="tabular-nums">
                  {fa(stats.candidates)} تا کاندید بودن ولی توضیحاتشون به قیدها نخورد.
                </p>
              )}
              {stats.nearMiss > 0 && (
                <p className="tabular-nums">
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

      {/* Deep history opt-in — only when there ARE results (empty state has its own). */}
      {done && stats !== null && stats.adsSeen > 0 && results.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm">این‌ها از آگهی‌های چند روز اخیر بودن.</p>
          <button
            type="button"
            onClick={goDeep}
            disabled={deepening}
            className="mt-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {deepening ? "دارم آماده می‌کنم..." : "می‌خوای برم سراغ قدیمی‌ترها؟"}
          </button>
        </section>
      )}

      {/* Bottom-left viewed counter (UX 2) — so the user never feels lost.
          Tab bar is ~80px tall; place at 96px to clear it. */}
      {results.length > 0 && (
        <div
          aria-hidden
          className="fixed bottom-24 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-[11px] font-medium tabular-nums text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-400"
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
    </div>
  );
}
