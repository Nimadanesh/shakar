import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

interface SavedHuntRow {
  id: string;
  name: string;
  definition: unknown;
  created_at: string;
}

/**
 * GET /api/me/saved-hunts — the logged-in user's saved hunt definitions.
 * 401 for guests (they use device-local storage).
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
    const rows = await sb.rest<SavedHuntRow[]>(
      "GET",
      `saved_hunts?user_id=eq.${encodeURIComponent(userId)}&select=id,name,definition,created_at&order=created_at.desc&limit=200`
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (e) {
    console.warn("[saved-hunts/get]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}

/**
 * POST /api/me/saved-hunts — save a hunt definition { name, definition }.
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
    name?: unknown;
    definition?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (name === "" || body?.definition === undefined) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }
  try {
    const rows = await sb.rest<Array<{ id: string }>>("POST", "/saved_hunts", {
      user_id: userId,
      name,
      definition: body.definition,
    }, "return=representation");
    return NextResponse.json({ ok: true, data: { id: rows[0]?.id ?? null } });
  } catch (e) {
    console.warn("[saved-hunts/post]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/me/saved-hunts?id=… — delete a saved hunt (ownership checked).
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
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (id === "") {
    return NextResponse.json({ ok: false, error: "empty-id" }, { status: 400 });
  }
  try {
    await sb.rest(
      "DELETE",
      `saved_hunts?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`
    );
    return NextResponse.json({ ok: true, data: { id } });
  } catch (e) {
    console.warn("[saved-hunts/delete]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
