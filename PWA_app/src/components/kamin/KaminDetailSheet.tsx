"use client";

import { useEffect, useState } from "react";
import { Activity, BellRing, Clock3, Radar } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { categoryLabel, cityLabel } from "@/data/taxonomy";
import { formatPriceCompact } from "@/lib/prices";
import { relativeTime } from "@/lib/hunt-summary";
import {
  fetchKaminActivity,
  type KaminActivity,
  type ServerKamin,
} from "@/lib/kamin-client";

const CADENCE_FA: Record<string, string> = {
  "5min": "هر ۵ دقیقه",
  "15min": "هر ۱۵ دقیقه",
  "30min": "هر ۳۰ دقیقه",
  hourly: "هر ساعت",
  daily: "روزانه",
};

function faNum(n: number): string {
  return n.toLocaleString("fa-IR");
}

function RunDot({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "baseline"
          ? "bg-sky-500"
          : "bg-amber-500 animate-pulse";
  const label =
    status === "completed"
      ? "موفق"
      : status === "failed"
        ? "ناموفق"
        : status === "baseline"
          ? "شروع"
          : "در حال اجرا";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <span className={`size-2 rounded-full ${cls}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Kamin detail sheet (navid 2026-10-08): the user forgot what they set
 * up, so one tap shows the hunt definition PLUS the work diary — how
 * often it checks, how many times it ran, what each run found. This is
 * the "it works while the app is closed" feeling that sells plans, so
 * the activity proof comes first, definition second.
 */
export function KaminDetailSheet({
  kamin,
  open,
  onClose,
  onViewResults,
  onDisarm,
}: {
  kamin: ServerKamin | null;
  open: boolean;
  onClose: () => void;
  onViewResults?: () => void;
  onDisarm: () => void;
}) {
  const [activity, setActivity] = useState<KaminActivity | null | undefined>(undefined);

  useEffect(() => {
    if (!open || !kamin) return;
    setActivity(undefined);
    let cancelled = false;
    fetchKaminActivity(kamin.id).then((a) => {
      if (!cancelled) setActivity(a ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, kamin]);

  if (!kamin) return null;
  const d = kamin.definition;
  const chips: string[] = [];
  if (d.city && d.city !== "all") chips.push(cityLabel(d.city));
  if (d.category && d.category !== "all") chips.push(categoryLabel(d.category));
  if (d.priceMin != null || d.priceMax != null) {
    chips.push(
      d.priceMin != null && d.priceMax != null
        ? `از ${formatPriceCompact(d.priceMin)} تا ${formatPriceCompact(d.priceMax)}`
        : d.priceMax != null
          ? `تا ${formatPriceCompact(d.priceMax)}`
          : `از ${formatPriceCompact(d.priceMin as number)}`
    );
  }

  const lastRun = activity?.runs?.[0];
  const lastChecked = lastRun
    ? relativeTime(new Date(lastRun.started_at).getTime())
    : kamin.last_checked_at
      ? relativeTime(new Date(kamin.last_checked_at).getTime())
      : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={`جزئیات کمین ${kamin.name}`}
      title={
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-right">«{kamin.name}»</span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              kamin.status === "active"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {kamin.status === "active" ? "فعال" : "خوابیده"}
          </span>
        </span>
      }
      subtitle="کمینت داره کار می‌کنه — حتی وقتی اپ بسته‌ست"
    >
      {/* Proof of work first */}
      <section aria-label="گزارش فعالیت" className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Activity size={15} aria-hidden="true" className="text-muted-foreground" />
          گزارش فعالیت
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">
              {activity === undefined ? "…" : faNum(activity?.totalRuns ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">دفعات اجرا</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground">
              {activity === undefined ? "…" : faNum(activity?.totalNew ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">آگهی تازه</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
            <p className="text-[13px] font-bold leading-7 text-foreground">
              {CADENCE_FA[kamin.cadence] ?? kamin.cadence}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">تناوب بررسی</p>
          </div>
        </div>
        {/* The last-checked line reserves its space while loading — it must
            never pop the layout when the data arrives (navid 2026-10-08:
            no page jumps, ever). */}
        {activity === undefined ? (
          <p aria-hidden="true" className="flex items-center gap-1.5">
            <span className="size-3.5 animate-pulse rounded-full bg-secondary" />
            <span className="h-3 w-32 animate-pulse rounded-md bg-secondary" />
          </p>
        ) : (
          lastChecked && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock3 size={14} aria-hidden="true" />
              آخرین بررسی: {lastChecked}
            </p>
          )
        )}
        {/*
          Fixed-height activity region (navid 2026-10-08): the sheet must
          NEVER resize when the report loads. The region always occupies
          4 run rows; the skeleton mirrors the rows 1:1, extra runs scroll
          inside, and the empty/degraded messages are centered in the same
          space. Every state, one size.
        */}
        <div
          className="h-[172px] overflow-y-auto"
          aria-busy={activity === undefined}
          aria-label={activity === undefined ? "در حال بارگذاری گزارش" : undefined}
        >
          {activity === undefined ? (
            <ul className="flex flex-col gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="h-3 w-24 animate-pulse rounded-md bg-secondary" />
                  <span className="h-3 w-16 animate-pulse rounded-md bg-secondary" />
                </li>
              ))}
            </ul>
          ) : activity === null || activity.degraded ? (
            <div className="flex h-full items-center justify-center">
              <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[12px] leading-5 text-muted-foreground">
                گزارش اجراها در دسترس نیست — ولی کمین فعاله و داره بررسی می‌کنه.
              </p>
            </div>
          ) : activity.runs.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[12px] leading-5 text-muted-foreground">
                هنوز اولین بررسی انجام نشده — به‌زودی اینجا می‌بینی.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5" aria-label="اجراهای اخیر">
              {activity.runs.slice(0, 6).map((run) => (
                <li
                  key={run.started_at}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-[12px] text-muted-foreground">
                    {relativeTime(new Date(run.started_at).getTime())}
                  </span>
                  <span className="flex items-center gap-3">
                    {run.new_count > 0 && (
                      <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {faNum(run.new_count)} تازه
                      </span>
                    )}
                    <RunDot status={run.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* What it's watching */}
      <section aria-label="مشخصات شکار" className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Radar size={15} aria-hidden="true" className="text-muted-foreground" />
          چی رو زیر نظر داره
        </h3>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
          {d.query.trim() !== "" && (
            <p className="line-clamp-2 text-[13px] font-medium leading-6 text-foreground">
              {d.query}
            </p>
          )}
          {((d.include?.length ?? 0) > 0 || (d.exclude?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(d.include ?? []).map((t) => (
                <span
                  key={`i-${t}`}
                  className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[12px] leading-5 text-foreground"
                >
                  {t}
                </span>
              ))}
              {(d.exclude ?? []).map((t) => (
                <span
                  key={`e-${t}`}
                  className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[12px] leading-5 text-muted-foreground line-through"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <p className="text-[12px] leading-5 text-muted-foreground">{chips.join(" • ")}</p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        {onViewResults && (
          <button
            type="button"
            onClick={onViewResults}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-action-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
          >
            <BellRing size={17} aria-hidden="true" />
            دیدن نتایج تازه
          </button>
        )}
        <ConfirmButton
          label="غیرفعال کردن کمین"
          confirmLabel="مطمئنی؟ برای تأیید دوباره بزن"
          onConfirm={() => {
            onDisarm();
            onClose();
          }}
        />
      </div>
    </BottomSheet>
  );
}
