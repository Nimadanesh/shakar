import {
  appendRunEvent,
  canOpenRun,
  claimRunForExecution,
  finalizeRun,
  getBackendKind,
  getRun,
  getRunStatus,
  readRunEvents,
  runCompletionSideEffects,
} from "@/lib/server/hunt/runs";
import type { HuntRun } from "@/lib/server/hunt/runs";
import { runPipeline, type HuntEvent } from "@/lib/server/hunt/pipeline";
import { getSessionUserId } from "@/lib/server/auth";

/** Tunables for the cross-instance follow loop (tests shrink them). */
export const streamTuning = {
  /** ms between event-table polls while following another instance. */
  pollMs: 1000,
  /** give up following after this long (client can re-GET to replay). */
  timeoutMs: 15 * 60_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * GET /api/hunts/[id]/stream — Server-Sent Events. Runs the pipeline and
 * streams HuntEvents (staged progress per docs/hunt-progress-copy.md),
 * ending with { type: "done", results, stats }.
 *
 * Run lifecycle (findings #3/#4, bug-bounty 2026-10-06; #9 for persistence):
 * - Ownership: a signed-in user can only open their OWN runs (403
 *   otherwise). Guest runs are capability-protected by the unguessable
 *   UUID run id.
 * - Exactly one execution per run. The first GET becomes the owner and
 *   runs the pipeline; a second GET while running ATTACHES to the live
 *   broadcast (refresh-safe); after completion the event log is replayed.
 *   The pipeline, the kamin baseline advance, and the fairness refund each
 *   happen exactly once — a run can never be replayed for quota abuse.
 * - Finding #9: runs, idempotency keys and the event log are DB-persisted,
 *   so streams survive restarts and work when the pipeline runs on another
 *   instance (replay in id order + poll until terminal). Without Supabase,
 *   the original in-memory path is used.
 *
 * Fairness: a hunt that yields ZERO confirmed results, or fails on OUR side
 * (timeout / upstream-down), refunds the consumed quota unit — the user pays
 * for hunts, not for our errors. (Abuse ladder inside refundHunt.)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) {
    return new Response("run not found or expired", { status: 404 });
  }

  let requester: string | null = null;
  try {
    requester = await getSessionUserId();
  } catch {
    requester = null;
  }
  if (!canOpenRun(run, requester)) {
    return new Response("forbidden", { status: 403 });
  }

  if ((await getBackendKind()) === "memory") {
    return memoryStream(run, await claimRunForExecution(run));
  }
  return dbStream(run);
}

// ---------------------------------------------------------------------------
// In-memory backend: the pre-#9 behavior, unchanged.
// ---------------------------------------------------------------------------

function memoryStream(run: HuntRun, isOwner: boolean): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: HuntEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client went away */
        }
      };

      if (!isOwner) {
        // Re-attach: replay the log, then follow the live broadcast.
        for (const e of run.eventLog) send(e);
        if (run.status === "done" || run.status === "failed") {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          return;
        }
        let attached = true;
        const listener = (e: HuntEvent) => {
          if (attached) send(e);
        };
        run.listeners.add(listener);
        try {
          await run.donePromise;
        } finally {
          attached = false;
          run.listeners.delete(listener);
          try {
            controller.close();
          } catch {
            /* client went away */
          }
        }
        return;
      }

      // Owner: exactly one pipeline execution per run.
      const broadcast = (e: HuntEvent) => {
        run.eventLog.push(e);
        send(e);
        for (const l of run.listeners) {
          try {
            l(e);
          } catch {
            /* a dead listener never breaks the hunt */
          }
        }
      };
      let sawResults = false;
      let errored = false;
      const finalIds: string[] = [];
      const wrappedSend = (e: HuntEvent) => {
        if (e.type === "done") {
          if (e.results.length > 0) sawResults = true;
          for (const r of e.results) finalIds.push(r.sourceAdId);
        }
        if (e.type === "error") errored = true;
        broadcast(e);
      };
      try {
        const { endCursor } = await runPipeline(run.def, wrappedSend, {
          startCursor: run.startCursor,
        });
        run.endCursor = endCursor;
      } catch {
        // The pipeline already emitted { type: "error" } before throwing.
        errored = true;
      } finally {
        run.status = errored ? "failed" : "done";
        if (!run.finalized) {
          run.finalized = true;
          await runCompletionSideEffects(run, { sawResults, errored, finalIds });
        }
        run.resolveDone();
        try {
          controller.close();
        } catch {
          /* client went away */
        }
      }
    },
  });

  return sseResponse(stream);
}

// ---------------------------------------------------------------------------
// DB backend (finding #9): cross-instance replay + follow.
// ---------------------------------------------------------------------------

function isTerminalEvent(e: HuntEvent): boolean {
  return e.type === "done" || e.type === "error";
}

/**
 * Non-owner path: replay stored events in id order, then poll for new rows
 * until a terminal event or a terminal run status (the status check covers
 * a loudly-logged lost terminal event), or the follow timeout.
 */
async function replayAndFollow(
  runId: string,
  send: (e: HuntEvent) => void
): Promise<void> {
  let lastId = 0;
  let terminal = false;
  const drain = async () => {
    for (const { id, event } of await readRunEvents(runId, lastId)) {
      send(event);
      lastId = id;
      if (isTerminalEvent(event)) terminal = true;
    }
  };
  await drain();
  const t0 = Date.now();
  while (!terminal && Date.now() - t0 < streamTuning.timeoutMs) {
    const st = await getRunStatus(runId);
    if (st === "done" || st === "failed" || st === null) break;
    await sleep(streamTuning.pollMs);
    await drain();
  }
}

function dbStream(run: HuntRun): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: HuntEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client went away */
        }
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Atomic claim (conditional UPDATE created → running): exactly one
      // instance becomes the owner, even across processes.
      const isOwner = await claimRunForExecution(run);
      if (!isOwner) {
        await replayAndFollow(run.id, send);
        close();
        return;
      }

      // Owner: run the pipeline, persist every event, then finalize.
      // Event inserts are tracked (not fire-and-forget) and ALL awaited
      // before finalization — the event table is the replay source, so no
      // emitted event may be silently lost.
      const pending: Promise<void>[] = [];
      let sawResults = false;
      let errored = false;
      const finalIds: string[] = [];
      const wrappedSend = (e: HuntEvent) => {
        if (e.type === "done") {
          if (e.results.length > 0) sawResults = true;
          for (const r of e.results) finalIds.push(r.sourceAdId);
        }
        if (e.type === "error") errored = true;
        pending.push(appendRunEvent(run.id, e));
        send(e);
      };
      let endCursor: unknown;
      try {
        ({ endCursor } = await runPipeline(run.def, wrappedSend, {
          startCursor: run.startCursor,
        }));
      } catch {
        // The pipeline already emitted { type: "error" } before throwing.
        errored = true;
      }
      await Promise.all(pending);
      const status = errored ? "failed" : "done";
      // Conditional finalization: exactly one closer per run, and the end
      // cursor lands in the row for the deepen phase.
      const finalized = await finalizeRun(run.id, status, endCursor);
      if (finalized) {
        await runCompletionSideEffects(run, { sawResults, errored, finalIds });
      }
      close();
    },
  });

  return sseResponse(stream);
}
