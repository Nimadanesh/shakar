import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

interface HuntRunRow {
  id: string;
  definition: { query?: string } | null;
  status: string;
  created_at: string;
}
/**
 * DELETE /api/me/history?runId=… — remove one hunt run from the user's
 * history. Owner-scoped: only the run's owner can delete it. The client
 * tombstones the runId locally first, so the merge can never resurrect it
 * even if this request fails (retry on next sync).
 */
export async function DELETE(req: Request): Promise<NextResponse> {
  if (!supabaseConfigured() || !supabaseServer()) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "guest" }, { status: 401 });
  }
  const runId = new URL(req.url).searchParams.get("runId")?.trim() ?? "";
  if (runId === "") {
    return NextResponse.json({ ok: false, error: "empty-run-id" }, { status: 400 });
  }
  try {
    await sb.rest(
      "DELETE",
      `hunt_runs?id=eq.${encodeURIComponent(runId)}&owner_user_id=eq.${encodeURIComponent(userId)}`
    );
    return NextResponse.json({ ok: true, data: { runId } });
  } catch (e) {
    console.warn("[history/delete]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "delete-failed" }, { status: 500 });
  }
}

/**
 * GET /api/me/history — the logged-in user's hunt history, derived from
 * hunt_runs (owner_user_id). No new table: the runs already record who
 * fired them.
 *
 * 401 for guests (they use device-local history).
 */
export async function GET(): Promise<NextResponse> {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, data: null });
  const sb = supabaseServer();
  if (!sb) return NextResponse.json({ ok: true, data: null });
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "guest" }, { status: 401 });
  }
  try {
    const rows = await sb.rest<HuntRunRow[]>(
      "GET",
      `hunt_runs?owner_user_id=eq.${encodeURIComponent(userId)}&select=id,definition,status,created_at&order=created_at.desc&limit=200`
    );
    const data = rows.map((r) => ({
      runId: r.id,
      query: typeof r.definition?.query === "string" ? r.definition.query : "",
      status: r.status,
      ts: new Date(r.created_at).getTime(),
      // The full definition lets the client merge a normalize()-compatible
      // record (base included) — without it merged history is dropped.
      definition: r.definition,
    }));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.warn("[history/get]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}
