import { NextResponse } from "next/server";
import { canOpenRun, createRun, getRun } from "@/lib/server/hunt/runs";
import { getSessionUserId } from "@/lib/server/auth";

/**
 * POST /api/hunts/[id]/deepen — the «می‌خوای برم سراغ قدیمی‌ترها؟» second
 * phase. Creates a new run with the SAME definition + deepHistory: true
 * (older pages). No extra quota: it's the same hunt continued, and the
 * user explicitly chose the longer wait.
 *
 * The deep walk resumes from the first phase's endCursor (finding #1) —
 * deepening a still-running or failed hunt is rejected.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run-not-found" }, { status: 404 });
  }
  let requester: string | null = null;
  try {
    requester = await getSessionUserId();
  } catch {
    requester = null;
  }
  if (!canOpenRun(run, requester)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (run.def.deepHistory === true) {
    return NextResponse.json({ ok: false, error: "already-deep" }, { status: 400 });
  }
  if (run.status !== "done") {
    return NextResponse.json(
      { ok: false, error: "hunt-not-finished" },
      { status: 409 }
    );
  }
  const deep = createRun(
    { ...run.def, deepHistory: true },
    run.userId,
    { ...run.quota, charged: false }
  );
  deep.startCursor = run.endCursor;
  return NextResponse.json({ ok: true, data: { runId: deep.id } }, { status: 202 });
}
