import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

const MAX_NAME = 40;

/**
 * GET /api/me/profile — the logged-in user's display name.
 * Null when guest or unavailable → the client keeps its device-local name.
 */
export async function GET(): Promise<NextResponse> {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, data: null });
  const sb = supabaseServer();
  if (!sb) return NextResponse.json({ ok: true, data: null });
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ ok: true, data: null });
    const rows = await sb.rest<Array<{ display_name: string | null }>>(
      "GET",
      `profiles?id=eq.${encodeURIComponent(userId)}&select=display_name&limit=1`
    );
    const name = rows[0]?.display_name?.trim() ?? "";
    return NextResponse.json({ ok: true, data: { name } });
  } catch (e) {
    console.warn("[profile]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}

/**
 * PUT /api/me/profile — save the logged-in user's display name.
 * Guests have no account to attach a name to → 401, client keeps local.
 */
export async function PUT(req: Request): Promise<NextResponse> {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const sb = supabaseServer();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "guest" }, { status: 401 });
    }
    const body: unknown = await req.json().catch(() => null);
    const raw = (body as { name?: unknown } | null)?.name;
    const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME) : "";
    if (name === "") {
      return NextResponse.json({ ok: false, error: "empty-name" }, { status: 400 });
    }
    await sb.rest(
      "PATCH",
      `profiles?id=eq.${encodeURIComponent(userId)}`,
      { display_name: name }
    );
    return NextResponse.json({ ok: true, data: { name } });
  } catch (e) {
    console.warn("[profile]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
