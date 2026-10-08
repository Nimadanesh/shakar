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
    }));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.warn("[history/get]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}
