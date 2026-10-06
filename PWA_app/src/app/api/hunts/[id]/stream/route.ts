import { getRun } from "@/lib/server/hunt/runs";
import { refundHunt } from "@/lib/server/quota";
import { runPipeline, type HuntEvent } from "@/lib/server/hunt/pipeline";

/**
 * GET /api/hunts/[id]/stream — Server-Sent Events. Runs the pipeline and
 * streams HuntEvents (staged progress per docs/hunt-progress-copy.md),
 * ending with { type: "done", results, stats }.
 *
 * If the client disconnects, the request aborts and the pipeline stops —
 * no wasted upstream work for an abandoned hunt.
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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: HuntEvent) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      let sawResults = false;
      let errored = false;
      const wrappedSend = (e: HuntEvent) => {
        if (e.type === "done" && e.results.length > 0) sawResults = true;
        if (e.type === "error") errored = true;
        send(e);
      };
      try {
        await runPipeline(run.def, wrappedSend);
      } catch {
        // The pipeline already emitted { type: "error" } before throwing.
        errored = true;
      } finally {
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
