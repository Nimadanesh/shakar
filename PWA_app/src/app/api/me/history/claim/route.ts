import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * POST /api/me/history/claim — claim this device's orphaned guest runs.
 *
 * Guest-fired hunts have owner_user_id NULL (and owner_device_id set).
 * When the guest later logs in on the same device, this flips those runs
 * to the new account so they appear in server history instead of being
 * orphaned forever. Idempotent: only NULL-owner rows move, so repeats
 * claim nothing.
 *
 * Body: { deviceId: "<uuid>" }. 401 for guests.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!supabaseConfigured() || !supabaseServer()) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "guest" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    deviceId?: unknown;
  } | null;
  if (!isUuid(body?.deviceId)) {
    return NextResponse.json({ ok: false, error: "bad-device" }, { status: 400 });
  }
  try {
    const rows = await sb.rest<Array<{ id: string }>>(
      "PATCH",
      `hunt_runs?owner_device_id=eq.${encodeURIComponent(body.deviceId as string)}` +
        `&owner_user_id=is.null`,
      { owner_user_id: userId },
      "return=representation"
    );
    return NextResponse.json({ ok: true, data: { claimed: rows.length } });
  } catch (e) {
    console.warn("[history/claim]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
