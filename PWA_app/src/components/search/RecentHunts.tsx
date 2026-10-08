"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, History } from "lucide-react";
import { readHunts, type HuntRecord } from "@/lib/hunt-store";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { useActiveHunt } from "@/hooks/useActiveHunt";
import { LoaderGrid } from "@/components/ui/LoadingState";
import { SkeletonRow } from "@/components/ui/skeletons";
import { huntSpecSummary } from "@/lib/hunt-summary";

const MAX_ROWS = 4;

/**
 * The pro's shortcut: one tap back into a previous hunt's triage (free —
 * the results are persisted, nothing re-fires). Renders nothing when
 * history is empty unless an `empty` fallback is given (the شکارها tab).
 */
export function RecentHunts({ empty }: { empty?: ReactNode }) {
  // Session-cached: the first visit per session shows skeletons (SSR-safe),
  // every later visit renders the known history immediately — no
  // skeleton → content → vanish jump when navigating.
  const { value: hunts, ready } = useHydratedStore<HuntRecord[]>("hunts", readHunts);
  // The live hunt (if any) gets our cube loader instead of the history
  // clock — recognizable at a glance as "still reviewing".
  const activeHunt = useActiveHunt();
  const rows = (hunts ?? []).slice(0, MAX_ROWS);

  // First paint per session: skeletons WITHOUT the section label — the
  // label only appears once we know there's content. Showing "شکارهای اخیر"
  // then collapsing it a frame later (zero-history users) was a visible
  // flash on every first visit.
  if (!ready)
    return (
      <div aria-busy="true" className="flex flex-col gap-1.5" aria-label="در حال بارگذاری">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  if (rows.length === 0) return empty ?? null;

  return (
    <section aria-label="شکارهای اخیر" className="flex flex-col gap-2">
      <p className="text-xs leading-5 text-muted-foreground">شکارهای اخیر</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((hunt) => {
          const isLive =
            activeHunt !== null && (hunt.runId ?? hunt.id) === activeHunt.runId;
          return (
          <li key={hunt.id}>
            <Link
              href={`/results/${hunt.runId ?? hunt.id}`}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
            >
              {isLive ? (
                <span aria-label="در حال بررسی" className="shrink-0">
                  <LoaderGrid tone="default" />
                </span>
              ) : (
                <History
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {hunt.query}
                </span>
                <span className="block truncate text-[11px] leading-5 text-muted-foreground">
                  {huntSpecSummary(hunt)}
                </span>
              </span>
              <ChevronLeft
                size={15}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
          );
        })}
      </ul>
      <Link
        href="/archive"
        className="py-1 text-center text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        همه در آرشیو
      </Link>
    </section>
  );
}
