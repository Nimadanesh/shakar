import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";

/**
 * GET /api/notifications — the user's notification inbox, newest first.
 * Query: ?unread=true to get only unseen, ?limit=N (default 20, max 50).
 */
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
    50
  );
  const sb = supabaseServer()!;
  let q = `notifications?user_id=eq.${encodeURIComponent(userId)}&select=id,type,title,body,created_at,seen,related_kamin_id&order=created_at.desc&limit=${limit}`;
  if (unreadOnly) q += `&seen=eq.false`;
  try {
    const rows = await sb.rest<
      Array<{
        id: string;
        type: string;
        title: string;
        body: string;
        created_at: string;
        seen: boolean;
        related_kamin_id: string | null;
      }>
    >("GET", q);
    const unreadCount = unreadOnly
      ? rows.length
      : rows.filter((r) => !r.seen).length;
    return NextResponse.json({ ok: true, data: { notifications: rows, unreadCount } });
  } catch {
    return NextResponse.json({ ok: false, error: "db-error" }, { status: 500 });
  }
}
