"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { readHunts } from "@/lib/hunt-store";
import { useServerUsage } from "@/lib/usage";
import { TIERS, tierByKey } from "@/lib/tiers";

const DAY_MS = 24 * 60 * 60 * 1000;

interface SubPrice {
  tier: string;
  billing: "monthly" | "annual";
  usd: number;
  toman: number;
  dollarRate: number;
}

type SubStatus = "pending" | "active" | "expired" | "canceled";

interface SubRow {
  id: string;
  tier: string;
  status: SubStatus;
  billing: "monthly" | "annual";
  price_toman: number;
  cycle_ends_at: string | null;
}

interface SubData {
  subscription: SubRow | null;
  prices: SubPrice[];
  renewalDate: string | null;
}

type SubLoad =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: SubData }
  | { state: "unauth" }
  | { state: "error" };

type IntentState =
  | { state: "idle" }
  | { state: "sending"; tier: string }
  | { state: "done"; tier: string; message: string }
  | { state: "error"; tier: string; message: string };

const STATUS_FA: Record<SubStatus, string> = {
  pending: "در انتظار فعال‌سازی",
  active: "فعال",
  expired: "منقضی شده",
  canceled: "لغو شده",
};

/**
 * «پلن و هزینه‌ها» — the user's financial surface.
 *
 * Usage numbers are real (server first — identical on every device — local
 * history as fallback). Tier prices come from GET /api/subscription
 * (dollar-pegged, server-side). Buying = POST /api/subscription/intent
 * (MVP: records a pending intent, no charging — the gateway plugs into
 * the same intent later). Anything unknown is shown honestly as unknown —
 * never invented.
 */
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  // Server first (identical on every device), local history as fallback.
  const serverUsage = useServerUsage();
  const [sub, setSub] = useState<SubLoad>({ state: "idle" });
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [intent, setIntent] = useState<IntentState>({ state: "idle" });

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
    return {
      used: thisMonth.length,
      days,
      total: hunts.length,
      quota: null as number | null,
      remaining: null as number | null,
    };
  }, [open, serverUsage ]);

  const loadSubscription = () => {
    let cancelled = false;
    setSub({ state: "loading" });
    fetch("/api/subscription")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setSub({ state: "unauth" });
          return;
        }
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: SubData;
        } | null;
        if (json?.ok && json.data) setSub({ state: "ready", data: json.data });
        else setSub({ state: "error" });
      })
      .catch(() => {
        if (!cancelled) setSub({ state: "error" });
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!open) return;
    setIntent({ state: "idle" });
    return loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const fa = (n: number) => n.toLocaleString("fa-IR");
  const faDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fa-IR") : "—";

  const priceFor = (tierKey: string): SubPrice | null => {
    if (sub.state !== "ready") return null;
    return sub.data.prices.find((p) => p.tier === tierKey && p.billing === billing) ?? null;
  };

  async function choosePlan(tierKey: string) {
    setIntent({ state: "sending", tier: tierKey });
    try {
      const res = await fetch("/api/subscription/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey, billing }),
      });
      if (res.status === 401) {
        // Guest tapped buy → log in first, then the pending action resumes.
        onClose();
        router.push("/auth");
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { message?: string };
        message?: string;
        error?: string;
      } | null;
      if (json?.ok) {
        setIntent({
          state: "done",
          tier: tierKey,
          message: json.data?.message ?? "درخواستت ثبت شد.",
        });
        loadSubscription();
      } else {
        setIntent({
          state: "error",
          tier: tierKey,
          message: json?.message ?? "خطایی رخ داد — دوباره تلاش کن.",
        });
      }
    } catch {
      setIntent({ state: "error", tier: tierKey, message: "ارتباط با سرور برقرار نشد." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  const maxDay = stats ? Math.max(1, ...stats.days) : 1;
  const currentSub = sub.state === "ready" ? sub.data.subscription : null;
  const currentTier = currentSub ? tierByKey(currentSub.tier) : null;

  return (
    <BottomSheet open={open} onClose={onClose} label="پلن و هزینه‌ها" title="پلن و هزینه‌ها">
      <div className="flex flex-col gap-4 pb-2">
        {/* Current subscription — real server state, never invented. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">اشتراک فعلی</span>
            {sub.state === "loading" && (
              <span className="animate-pulse text-[13px] text-muted-foreground">…</span>
            )}
            {sub.state === "unauth" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/auth");
                }}
                className="rounded-full bg-foreground px-3 py-1.5 text-[12px] font-medium text-background"
              >
                ورود / ساخت حساب
              </button>
            )}
            {sub.state === "ready" && currentSub && currentTier && (
              <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                {currentTier.name}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4">
                  {STATUS_FA[currentSub.status]}
                </span>
              </span>
            )}
            {sub.state === "ready" && !currentSub && (
              <span className="text-[13px] font-medium text-foreground">اشتراکی نداری</span>
            )}
            {sub.state === "error" && (
              <span className="text-[13px] text-muted-foreground">نامشخص</span>
            )}
          </div>
          {sub.state === "ready" && currentSub && (
            <>
              <div className="h-px bg-border/60" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">تمدید بعدی</span>
                <span className="text-[13px] font-medium tabular-nums text-foreground">
                  {faDate(sub.data.renewalDate)}
                </span>
              </div>
            </>
          )}
          {sub.state === "error" && (
            <p className="text-[12px] leading-5 text-muted-foreground">
              نتونستم اطلاعات اشتراک رو بگیرم — با اینترنت که وصل شدی دوباره بازش کن.
            </p>
          )}
        </div>

        {/* Usage — real numbers, server first. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
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
              {stats?.remaining === null || stats?.remaining === undefined
                ? "—"
                : fa(stats.remaining)}
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

        {/* Plans — real prices from the server, buy = intent (MVP: no charging). */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium leading-5 text-foreground">پلن‌ها</p>
            <div
              className="flex rounded-full border border-border p-0.5"
              role="group"
              aria-label="نوع پرداخت"
            >
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBilling(b)}
                  aria-pressed={billing === b}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    billing === b
                      ? "bg-foreground text-background"
                      : "text-muted-foreground"
                  }`}
                >
                  {b === "monthly" ? "ماهانه" : "سالانه"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-border bg-card p-4">
            {TIERS.map((t, i) => {
              const price = priceFor(t.key);
              const isCurrent =
                currentSub?.status === "active" && currentSub.tier === t.key;
              const isPending =
                currentSub?.status === "pending" && currentSub.tier === t.key;
              const busy = intent.state === "sending" && intent.tier === t.key;
              return (
                <div key={t.key}>
                  {i > 0 && <div className="h-px bg-border/60" aria-hidden="true" />}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                        {t.name}
                        {isCurrent && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4">
                            پلن فعلی
                          </span>
                        )}
                        {isPending && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4">
                            در انتظار فعال‌سازی
                          </span>
                        )}
                      </span>
                      <span className="text-[12px] tabular-nums text-muted-foreground">
                        {fa(t.huntsPerMonth)} شکار • {fa(t.kaminSlots)} کمین • {t.cadenceFa}
                      </span>
                      <span className="text-[13px] font-medium tabular-nums text-foreground">
                        {price ? `${fa(price.toman)} تومان` : "—"}
                        <span className="font-normal text-muted-foreground">
                          {billing === "monthly" ? " / ماه" : " / سال"}
                        </span>
                      </span>
                    </div>
                    {!isCurrent && !isPending && (
                      <button
                        type="button"
                        disabled={busy || sub.state === "loading"}
                        onClick={() => choosePlan(t.key)}
                        className="shrink-0 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-foreground disabled:opacity-50"
                      >
                        {busy ? "…" : "انتخاب"}
                      </button>
                    )}
                  </div>
                  {intent.state === "error" && intent.tier === t.key && (
                    <p className="pb-2 text-[12px] leading-5 text-red-600 dark:text-red-400">
                      {intent.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {intent.state === "done" && (
            <p
              className="rounded-lg border border-border bg-card p-4 text-center text-[13px] leading-6 text-foreground"
              role="status"
            >
              {intent.message}
            </p>
          )}

          <p className="text-[12px] leading-5 text-muted-foreground">
            قیمت‌ها به دلار پگ‌اند و ماهانه به‌روز می‌شن — چون موتور شکار روی
            مدل‌های هوش مصنوعی کار می‌کنه که هزینه‌شون دلاریه.
          </p>
        </div>

        {/* Payment history — honest: only what the server knows. */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium leading-5 text-foreground">
            سوابق پرداخت
          </p>
          {sub.state === "ready" && currentSub ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  {tierByKey(currentSub.tier)?.name} —{" "}
                  {currentSub.billing === "monthly" ? "ماهانه" : "سالانه"}
                </span>
                <span className="text-[13px] font-medium tabular-nums text-foreground">
                  {fa(currentSub.price_toman)} تومان
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">وضعیت</span>
                <span className="text-[13px] text-foreground">
                  {STATUS_FA[currentSub.status]}
                </span>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-card p-4 text-center text-xs leading-5 text-muted-foreground">
              سابقه پرداختی ثبت نشده است.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
