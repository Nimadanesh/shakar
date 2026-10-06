import { getRun } from "@/lib/server/hunt/runs";
import { runPipeline, type HuntEvent } from "@/lib/server/hunt/pipeline";

/**
 * GET /api/hunts/[id]/stream — Server-Sent Events. Runs the pipeline and
 * streams HuntEvents (staged progress per docs/hunt-progress-copy.md),
 * ending with { type: "done", results, stats }.
 *
 * If the client disconnects, the request aborts and the pipeline stops —
 * no wasted upstream work for an abandoned hunt.
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
      try {
        await runPipeline(run.def, send);
      } catch {
        // The pipeline already emitted { type: "error" } before throwing.
      } finally {
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
