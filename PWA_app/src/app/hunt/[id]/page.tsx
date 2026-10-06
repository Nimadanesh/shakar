"use client";

import { use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HuntTriagePage } from "@/components/search/HuntTriagePage";
import { HuntProgress } from "@/components/search/HuntProgress";
import { readHunt } from "@/lib/hunt-store";

/**
 * /hunt/[id] — two modes:
 *  - local record exists (archive/saved replays, pre-M4 hunts) → HuntTriagePage;
 *  - otherwise the id is a server run id (M4) → HuntProgress (SSE stream).
 */
export default function HuntPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const local = useMemo(() => {
    try {
      return readHunt(id);
    } catch {
      return null;
    }
  }, [id]);

  if (local) {
    return (
      <main className="flex flex-1 flex-col py-4">
        <HuntTriagePage />
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
