import { canOpenRun, claimRunForExecution, getRun } from "@/lib/server/hunt/runs";
import { refundHunt } from "@/lib/server/quota";
import { runPipeline, type HuntEvent } from "@/lib/server/hunt/pipeline";
import { advanceKaminBaseline } from "@/lib/server/kamin/engine";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { getSessionUserId } from "@/lib/server/auth";

/**
 * GET /api/hunts/[id]/stream — Server-Sent Events. Runs the pipeline and
 * streams HuntEvents (staged progress per docs/hunt-progress-copy.md),
 * ending with { type: "done", results, stats }.
 *
 * Run lifecycle (findings #3/#4, bug-bounty 2026-10-06):
 * - Ownership: a signed-in user can only open their OWN runs (403
 *   otherwise). Guest runs are capability-protected by the unguessable
 *   UUID run id.
 * - Exactly one execution per run. The first GET becomes the owner and
 *   runs the pipeline; a second GET while running ATTACHES to the live
 *   broadcast (refresh-safe); after completion the event log is replayed.
 *   The pipeline, the kamin baseline advance, and the fairness refund each
 *   happen exactly once — a run can never be replayed for quota abuse.
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
  const run = getRun(id);
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

  // Atomic claim (synchronous — no awaits between getRun and here).
  const isOwner = claimRunForExecution(run);

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
          // Kamin baseline: a run fired from «دیدن نتایج» moves the seen
          // baseline ONLY after a successful hunt — a failed search never
          // swallows "new" matches (blueprint §1.8).
          if (run.kaminId && !errored && run.userId) {
            try {
              if (supabaseConfigured()) {
                await advanceKaminBaseline(
                  supabaseServer(),
                  run.kaminId,
                  run.userId,
                  finalIds
                );
              }
            } catch {
              /* baseline advance is best-effort; the hunt result matters more */
            }
          }
          // Fairness refund: zero results or our failure → give the unit back.
          // Deep-history runs were never charged, so there's nothing to refund.
          if (run.quota.charged && (!sawResults || errored)) {
            try {
              await refundHunt({
                userId: run.quota.userId,
                deviceId: run.quota.deviceId,
                kind: run.quota.kind,
                mode: run.quota.mode,
              });
            } catch {
              /* refund is best-effort; the hunt result matters more */
            }
          }
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
