import { NextResponse } from "next/server";
import { createRun, getRun } from "@/lib/server/hunt/runs";

/**
 * POST /api/hunts/[id]/deepen — the «می‌خوای برم سراغ قدیمی‌ترها؟» second
 * phase. Creates a new run with the SAME definition + deepHistory: true
 * (older pages). No extra quota: it's the same hunt continued, and the
 * user explicitly chose the longer wait.
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
  if (run.def.deepHistory === true) {
    return NextResponse.json({ ok: false, error: "already-deep" }, { status: 400 });
  }
  const deep = createRun(
    { ...run.def, deepHistory: true },
    run.userId,
    { ...run.quota, charged: false }
  );
  return NextResponse.json({ ok: true, data: { runId: deep.id } }, { status: 202 });
}
