import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";

interface KaminRunRow {
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | "baseline";
  pages_fetched: number;
  candidates: number;
  new_count: number;
}

/**
 * GET /api/kamins/:id/activity — the kamin's work diary.
 *
 * Powers the kamin detail sheet (navid 2026-10-08): the user forgot what
 * they set up, so we show the hunt definition PLUS proof of work — how
 * many times it ran, when, what each run found. Real data from kamin_runs
 * only; when the table is unreachable we say so instead of inventing.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const { id } = await params;

  // Verify ownership first — a kamin id alone grants nothing.
  const kaminRows = await sb.rest<Array<{ id: string }>>(
    "GET",
    `kamins?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`
  );
  if (kaminRows.length === 0) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  let runs: KaminRunRow[] = [];
  try {
    runs = await sb.rest<KaminRunRow[]>(
      "GET",
      `kamin_runs?kamin_id=eq.${encodeURIComponent(id)}` +
        `&user_id=eq.${encodeURIComponent(userId)}` +
        `&select=started_at,completed_at,status,pages_fetched,candidates,new_count` +
        `&order=started_at.desc&limit=20`
    );
  } catch {
    // Table missing / RLS issue: honest degraded response, not a 500.
    return NextResponse.json({
      ok: true,
      data: { runs: [], totalRuns: 0, totalNew: 0, degraded: true },
    });
  }

  const done = runs.filter((r) => r.status === "completed" || r.status === "baseline");
  return NextResponse.json({
    ok: true,
    data: {
      runs,
      totalRuns: done.length,
      totalNew: done.reduce((sum, r) => sum + (r.new_count ?? 0), 0),
      degraded: false,
    },
  });
}
