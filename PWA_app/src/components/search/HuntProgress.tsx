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

function ResultCard({ ad, index }: { ad: ScoredAd; index: number }) {
  return (
    <article
      className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-6">{ad.title}</h3>
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
        <p className="mt-1 text-xs text-zinc-500">
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
  const lineId = useRef(0);
  const seenResults = useRef(new Set<string>());

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
        case "filter-wave":
          pushTrace(
            e.wave === 0 && e.rejected > 0
              ? `این ${fa(e.rejected)} تای اول به دردت نمی‌خورن...`
              : `${fa(e.totalRejected)} تا رد شد...`,
            true
          );
          setCurrent("دارم بقیه‌ی تیترها رو چک می‌کنم...");
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
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Thinking trace — every line is a real pipeline event. */}
      <section
        aria-live="polite"
        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 ${done ? "" : "animate-pulse"}`}
          />
          <p className="text-sm font-medium">{done ? "شکار تموم شد" : "در حال شکار"}</p>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">«{query}»</p>
        <ul className="mt-3 space-y-1.5">
          {trace.map((l) => (
            <li key={l.id} className="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
              <span aria-hidden className="mt-0.5 shrink-0">
                {l.done ? "✓" : "…"}
              </span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
        {!done && (
          <p className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">{current}</p>
        )}
        {done && stats !== null && (
          <p className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">{current}</p>
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

      {/* Deep history opt-in — the same hunt continued, no extra quota. */}
      {done && stats !== null && stats.adsSeen > 0 && (
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
    </div>
  );
}
