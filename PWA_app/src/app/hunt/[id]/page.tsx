"use client";

import { use, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HuntProgress } from "@/components/search/HuntProgress";
import { LegacyHuntView } from "@/components/search/LegacyHuntView";
import { readHunt } from "@/lib/hunt-store";

/**
 * /hunt/[id] — the canonical hunt URL.
 *  - local record WITH a server runId (M4+) → redirect to /hunt/[runId];
 *  - local record WITHOUT a runId (legacy) → LegacyHuntView: the exact
 *    definition + one explicit re-fire. No fixture replay, ever;
 *  - otherwise the id is a server run id → HuntProgress (SSE stream,
 *    re-attach safe, completed runs render their results directly).
 */
export default function HuntPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const local = useMemo(() => {
    try {
      return readHunt(id);
    } catch {
      return null;
    }
  }, [id]);

  useEffect(() => {
    if (local?.runId && local.runId !== id) {
      router.replace(`/hunt/${encodeURIComponent(local.runId)}`);
    }
  }, [local, id, router]);

  if (local?.runId) {
    return (
      <main className="flex flex-1 flex-col py-4" aria-busy="true" aria-label="در حال انتقال">
        <div aria-hidden="true" className="mx-auto w-full max-w-xl px-3">
          <div className="h-14 animate-pulse rounded-lg bg-secondary" />
        </div>
      </main>
    );
  }

  if (local) {
    return (
      <main className="flex flex-1 flex-col py-4">
        <div className="mx-auto w-full max-w-xl px-3">
          <LegacyHuntView hunt={local} />
        </div>
      </main>
    );
  }

  const query = searchParams.get("q") ?? "";
  return (
    <main className="flex flex-1 flex-col py-4">
      <HuntProgress runId={id} query={query} />
    </main>
  );
}
