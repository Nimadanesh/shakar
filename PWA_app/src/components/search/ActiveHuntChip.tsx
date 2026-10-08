"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderGrid } from "@/components/ui/LoadingState";
import {
  clearActiveHunt,
  readActiveHunt,
  type ActiveHunt,
} from "@/lib/active-hunt";

/**
 * Sticky chip shown on every page while a hunt is running elsewhere.
 * Tapping returns to the live run (re-attach). Verifies against the
 * server once on mount — a finished hunt never shows as running.
 */
export function ActiveHuntChip() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveHunt | null>(null);

  useEffect(() => {
    const found = readActiveHunt();
    if (!found) return;
    let cancelled = false;
    fetch(`/api/hunts/${encodeURIComponent(found.runId)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          clearActiveHunt(found.runId);
          return;
        }
        return res.json().then((json: unknown) => {
          if (cancelled) return;
          const status = (json as { data?: { status?: string } })?.data?.status;
          if (status === "done" || status === "failed") {
            clearActiveHunt(found.runId);
          } else {
            setActive(found);
          }
        });
      })
      .catch(() => {
        // Offline: keep the chip; the run page will sort it out.
        if (!cancelled) setActive(found);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/hunt/${encodeURIComponent(active.runId)}?q=${encodeURIComponent(active.query)}`)
      }
      className="fixed bottom-24 right-3 z-40 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 py-2 pl-3 pr-4 shadow-lg backdrop-blur-md transition-transform hover:scale-[1.02] active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950/95"
      aria-label={`بازگشت به شکار در حال اجرا: ${active.query}`}
    >
      <LoaderGrid tone="default" />
      <span className="max-w-40 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
        در حال شکار «{active.query}»
      </span>
    </button>
  );
}
