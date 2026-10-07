import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";

/**
 * POST /api/notifications/read — mark notifications as seen.
 * Body: { ids: string[] } — marks those as seen.
 * Body: { all: true } — marks all of the user's as seen.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const b = (body ?? {}) as { ids?: unknown; all?: unknown };
  const sb = supabaseServer()!;
  try {
    if (b.all === true) {
      await sb.rest("PATCH", `notifications?user_id=eq.${encodeURIComponent(userId)}&seen=eq.false`, {
        seen: true,
      });
    } else if (Array.isArray(b.ids) && b.ids.length > 0) {
      const ids = b.ids.filter((x): x is string => typeof x === "string").slice(0, 100);
      if (ids.length === 0) {
        return NextResponse.json({ ok: false, error: "bad-ids" }, { status: 400 });
      }
      const inList = ids.map((id) => encodeURIComponent(id)).join(",");
      await sb.rest(
        "PATCH",
        `notifications?user_id=eq.${encodeURIComponent(userId)}&id=in.(${inList})`,
        { seen: true }
      );
    } else {
      return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "db-error" }, { status: 500 });
  }
}
