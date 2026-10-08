import { NextResponse } from "next/server";
import { getRun, canOpenRun } from "@/lib/server/hunt/runs";
import { getSessionUserId } from "@/lib/server/auth";

/**
 * GET /api/hunts/[id]/status — featherweight run status for the
 * ActiveHuntChip poller (navid 2026-10-08). The full GET returns the
 * entire results array for a done run; polling that every 15s while a
 * chip is visible would be wasteful. This returns only the status so
 * the chip can hide the moment the hunt completes — on ANY page.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let run;
  try {
    run = await getRun(id);
  } catch {
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
  return NextResponse.json({ ok: true, data: { status: run.status } });
}
