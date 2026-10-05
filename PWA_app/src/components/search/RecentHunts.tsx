"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, History } from "lucide-react";
import { readHunts, type HuntRecord } from "@/lib/hunt-store";
import { SkeletonRow } from "@/components/ui/skeletons";
import { cityLabel, categoryLabel } from "@/data/taxonomy";
import { formatPriceCompact } from "@/lib/prices";

const MAX_ROWS = 4;

function faNum(n: number): string {
  return n.toLocaleString("fa-IR");
}

function relativeTime(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return "لحظاتی پیش";
  if (minutes < 60) return `${faNum(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faNum(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faNum(days)} روز پیش`;
  return new Date(ts).toLocaleDateString("fa-IR", {
    day: "numeric",
    month: "short",
  });
}

/** One-line scan summary: city • category • price • age. Skips unset specs. */
function specSummary(hunt: HuntRecord): string {
  const parts: string[] = [];
  if (hunt.base.city !== "all") parts.push(cityLabel(hunt.base.city));
  if (hunt.base.category !== "all")
    parts.push(categoryLabel(hunt.base.category));
  const min = hunt.base.priceMin.trim();
  const max = hunt.base.priceMax.trim();
  if (min !== "" || max !== "") {
    const fmt = (v: string) => formatPriceCompact(Number(v));
    parts.push(
      min !== "" && max !== ""
        ? `از ${fmt(min)} تا ${fmt(max)}`
        : min !== ""
          ? `از ${fmt(min)}`
          : `تا ${fmt(max)}`
    );
  }
  parts.push(relativeTime(hunt.ts));
  return parts.join(" • ");
}

/**
 * The pro's shortcut: one tap back into a previous hunt's triage (free —
 * the results are persisted, nothing re-fires). Only renders when history
 * exists, so first-time users see the plain form.
 */
export function RecentHunts() {
  const [hunts, setHunts] = useState<HuntRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydration-safe init: first render must match SSR (empty), then hydrate
    // from localStorage. Deliberate, not a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHunts(readHunts().slice(0, MAX_ROWS));
    setReady(true);
  }, []);

  if (!ready)
    return (
      <section
        aria-label="شکارهای اخیر"
        aria-busy="true"
        className="flex flex-col gap-2"
      >
        <p className="text-xs leading-5 text-muted-foreground">شکارهای اخیر</p>
        <div className="flex flex-col gap-1.5">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </section>
    );
  if (hunts.length === 0) return null;

  return (
    <section aria-label="شکارهای اخیر" className="flex flex-col gap-2">
      <p className="text-xs leading-5 text-muted-foreground">شکارهای اخیر</p>
      <ul className="flex flex-col gap-1.5">
        {hunts.map((hunt) => (
          <li key={hunt.id}>
            <Link
              href={`/hunt/${hunt.id}`}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
            >
              <History
                size={15}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {hunt.query}
                </span>
                <span className="block truncate text-[11px] leading-5 text-muted-foreground">
                  {specSummary(hunt)}
                </span>
              </span>
              <ChevronLeft
                size={15}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
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
