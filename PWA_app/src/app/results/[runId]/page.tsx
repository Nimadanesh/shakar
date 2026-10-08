"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { HuntProgress } from "@/components/search/HuntProgress";

/**
 * /results/[runId] — the DEDICATED completed-hunt results page
 * (navid 2026-10-08).
 *
 * Tapping a hunt from archive / recents / search lands HERE, not on the
 * hunt-setup page. Closing (back) returns the user to exactly where they
 * were — the archive context is never lost.
 *
 * HuntProgress already owns the results-view contract (completed → results
 * directly, no re-fire, no stream). The results cache makes revisits instant.
 * For a still-running hunt, HuntProgress shows the live view with its own
 * navigation — this page is just the frame.
 */
export default function HuntResultsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const router = useRouter();

  function handleBack() {
    // Prefer the browser history (returns to archive/recents/search —
    // wherever the user came from). No history (deep link) → home.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <main className="flex flex-1 flex-col py-4">
      <div className="mx-auto w-full max-w-xl min-w-0 px-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="بازگشت"
          className="mb-2 flex h-10 items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowRight size={18} aria-hidden="true" />
          بازگشت
        </button>
      </div>
      <HuntProgress runId={runId} query="" />
    </main>
  );
}
