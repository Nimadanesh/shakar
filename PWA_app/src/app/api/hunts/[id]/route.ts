import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import {
  canOpenRun,
  getRun,
  readRunEvents,
} from "@/lib/server/hunt/runs";
import type { HuntEvent, HuntStats, ScoredAd } from "@/lib/server/hunt/pipeline";

/**
 * GET /api/hunts/[id] — run status + terminal results.
 *
 * The results VIEW backing: a completed run's results are served directly,
 * without opening the SSE stream and without replaying the "searching"
 * theater. Refreshing a finished hunt shows its results — never re-fires,
 * never consumes quota.
 *
 * Response: { ok: true, data: { status, definition, results?, stats? } }
 *  - status "running" → attach to /stream for live progress;
 *  - status "done" → results + stats included;
 *  - status "failed" → stats may be present, results empty;
 *  - 404 → run not found or expired (show the honest expired view).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let run;
  try {
    run = await getRun(id);
  } catch (e) {
    // A run we cannot read (DB down, malformed id for PostgREST, …) is
    // indistinguishable from a run that doesn't exist. The honest
    // response is the expired view with its rerun CTA — never a 500.
    console.error("[hunts/get] getRun failed:", e instanceof Error ? e.message : e);
    run = undefined;
  }
  if (!run) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "این شکار پیدا نشد." } },
      { status: 404 }
    );
  }

  let requester: string | null = null;
  try {
    requester = await getSessionUserId();
  } catch {
    requester = null;
  }
  if (!canOpenRun(run, requester)) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "دسترسی نداری." } },
      { status: 403 }
    );
  }

  let results: ScoredAd[] | undefined;
  let stats: HuntStats | undefined;
  if (run.status === "done" || run.status === "failed") {
    // Terminal event: memory backend replays run.eventLog, db backend
    // reads the persisted event table.
    let terminal: HuntEvent | undefined;
    for (const e of run.eventLog) {
      if (e.type === "done" || e.type === "error") terminal = e;
    }
    if (!terminal) {
      try {
        const stored = await readRunEvents(run.id);
        for (const { event } of stored) {
          if (event.type === "done" || event.type === "error") terminal = event;
        }
      } catch {
        // fall through — results simply unavailable
      }
    }
    if (terminal?.type === "done") {
      results = terminal.results;
      stats = terminal.stats;
    }
  }

  const res = NextResponse.json({
    ok: true,
    data: {
      status: run.status,
      definition: run.def,
      ...(results !== undefined ? { results } : {}),
      ...(stats !== undefined ? { stats } : {}),
    },
  });
  // Terminal runs are immutable — let the browser/proxy cache them instead
  // of re-downloading ~100 ads on every visit.
  if (run.status === "done" || run.status === "failed") {
    res.headers.set("Cache-Control", "public, max-age=1800, immutable");
  } else {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}
