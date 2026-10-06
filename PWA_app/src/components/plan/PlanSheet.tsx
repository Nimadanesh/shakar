"use client";

import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HUNTS_PER_MONTH } from "@/lib/pricing";
import { readHunts } from "@/lib/hunt-store";
import { useServerUsage } from "@/lib/usage";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * «پلن و هزینه‌ها» — the user's financial surface. Usage numbers are real
 * (server first — identical on every device — local history as fallback);
 * anything not yet decided (tiers, renewal) is shown honestly as unknown —
 * never invented.
 */
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Server first (identical on every device), local history as fallback.
  const serverUsage = useServerUsage();
  const stats = useMemo(() => {
    if (!open) return null;
    if (serverUsage) {
      const total = serverUsage.daily.reduce((a, b) => a + b, 0);
      return {
        used: serverUsage.usedThisMonth,
        days: serverUsage.daily,
        total,
        quota: serverUsage.quotaTotal,
        remaining: serverUsage.remaining,
        kind: serverUsage.kind,
      };
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const hunts = readHunts();
    const thisMonth = hunts.filter((h) => h.ts >= monthStart);
    const days: number[] = Array.from({ length: 14 }, (_, i) => {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i)).getTime();
      return hunts.filter((h) => h.ts >= dayStart && h.ts < dayStart + DAY_MS).length;
    });
    const quota = HUNTS_PER_MONTH;
    return {
      used: thisMonth.length,
      days,
      total: hunts.length,
      quota,
      remaining: quota === null ? null : Math.max(0, quota - thisMonth.length),
      kind: null as null,
    };
  }, [open, serverUsage ]);

  const fa = (n: number) => n.toLocaleString("fa-IR");
  const quota = stats?.quota ?? HUNTS_PER_MONTH;
  const remaining = stats?.remaining ?? null;
  const planLabel =
    stats?.kind === "user" && quota !== null
      ? `ماهانه — ${fa(quota)} شکار`
      : "ماهانه — پلن‌ها هنوز نهایی نشده";
  const maxDay = stats ? Math.max(1, ...stats.days) : 1;

  return (
    <BottomSheet open={open} onClose={onClose} label="پلن و هزینه‌ها" title="پلن و هزینه‌ها">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">اشتراک فعلی</span>
            <span className="text-[13px] font-medium text-foreground">
              {planLabel}
            </span>
          </div>
          <div className="h-px bg-border/60" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">شکارهای این ماه</span>
            <span className="text-[13px] font-medium tabular-nums text-foreground">
              {stats ? fa(stats.used) : "—"}
            </span>
          </div>
          <div className="h-px bg-border/60" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">سهمیه باقی‌مانده</span>
            <span className="text-[13px] font-medium tabular-nums text-foreground">
              {remaining === null ? "—" : fa(remaining)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] font-medium leading-5 text-foreground">
            شکارهای ۱۴ روز اخیر
          </p>
          {stats && stats.total > 0 ? (
            <div
              className="flex h-20 items-end gap-1.5 rounded-lg border border-border bg-card p-3"
              role="img"
              aria-label={`نمودار شکارهای ۱۴ روز اخیر — مجموع ${fa(stats.total)} شکار`}
            >
              {stats.days.map((count, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch"
                >
                  <div
                    className={`w-full rounded-sm ${count > 0 ? "bg-foreground" : "bg-border/50"}`}
                    style={{ height: `${Math.max(count > 0 ? 12 : 6, (count / maxDay) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-card p-4 text-center text-xs leading-5 text-muted-foreground">
              هنوز شکاری ثبت نشده — اولین شکار که بزنی، نمودار مصرفت اینجا می‌آید.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium leading-5 text-foreground">
            سوابق پرداخت
          </p>
          <p className="rounded-lg border border-border bg-card p-4 text-center text-xs leading-5 text-muted-foreground">
            سابقه پرداختی ثبت نشده است.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
