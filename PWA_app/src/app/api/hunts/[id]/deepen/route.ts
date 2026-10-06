import { NextResponse } from "next/server";
import {
  canOpenRun,
  createRun,
  getRun,
  hasDeepChild,
  isDeepenConflict,
  setRunStartCursor,
} from "@/lib/server/hunt/runs";
import { getSessionUserId } from "@/lib/server/auth";

/**
 * POST /api/hunts/[id]/deepen — the «می‌خوای برم سراغ قدیمی‌ترها؟» second
 * phase. Creates a new run with the SAME definition + deepHistory: true
 * (older pages). No extra quota: it's the same hunt continued, and the
 * user explicitly chose the longer wait.
 *
 * The deep walk resumes from the first phase's endCursor (finding #1) —
 * deepening a still-running or failed hunt is rejected. The resume cursor
 * is persisted on the deep run (finding #9) so any instance can stream it.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getRun(id);
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
  // Finding #12: one deepen per hunt. The parent is never marked by the
  // deep run's own def — a second deepen of the same parent must fail
  // even though the parent's def.deepHistory stays false.
  if (await hasDeepChild(id)) {
    return NextResponse.json({ ok: false, error: "already-deepened" }, { status: 400 });
  }
  if (run.status !== "done") {
    return NextResponse.json(
      { ok: false, error: "hunt-not-finished" },
      { status: 409 }
    );
  }
  let deep;
  try {
    deep = await createRun(
      { ...run.def, deepHistory: true },
      run.userId,
      { ...run.quota, charged: false },
      undefined,
      undefined,
      undefined,
      id
    );
  } catch (e) {
    // Concurrent-race path: both deepens passed the pre-check, the
    // deepened_from unique index let exactly one insert win (23505).
    if (isDeepenConflict(e)) {
      return NextResponse.json({ ok: false, error: "already-deepened" }, { status: 400 });
    }
    throw e;
  }
  // The deep run's stream resumes from the first phase's cursor
  // (memory: live object; DB: persisted row — see setRunStartCursor).
  await setRunStartCursor(deep, run.endCursor);
  return NextResponse.json({ ok: true, data: { runId: deep.id } }, { status: 202 });
}
