import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

interface FavoriteRow {
  ad_token: string;
  title: string;
  city: string | null;
  created_at: string;
}

/**
 * GET /api/me/favorites — the logged-in user's favorites (newest first).
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
    const rows = await sb.rest<FavoriteRow[]>(
      "GET",
      `favorites?user_id=eq.${encodeURIComponent(userId)}&select=ad_token,title,city,created_at&order=created_at.desc&limit=200`
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (e) {
    console.warn("[favorites/get]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}

/**
 * POST /api/me/favorites — add a favorite { adToken, title?, city? }.
 * Idempotent: re-favoriting the same ad is a no-op (unique constraint).
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
    adToken?: unknown;
    title?: unknown;
    city?: unknown;
  } | null;
  const adToken = typeof body?.adToken === "string" ? body.adToken.trim() : "";
  if (adToken === "") {
    return NextResponse.json({ ok: false, error: "empty-token" }, { status: 400 });
  }
  const title = typeof body?.title === "string" ? body.title.slice(0, 200) : "";
  const city = typeof body?.city === "string" ? body.city.slice(0, 60) : null;
  try {
    await sb.rest("POST", "/favorites", {
      user_id: userId,
      ad_token: adToken,
      title,
      city,
    }, "resolution=ignore-duplicates");
    return NextResponse.json({ ok: true, data: { adToken } });
  } catch (e) {
    console.warn("[favorites/post]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/me/favorites?adToken=… — remove a favorite.
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
  const adToken = new URL(req.url).searchParams.get("adToken")?.trim() ?? "";
  if (adToken === "") {
    return NextResponse.json({ ok: false, error: "empty-token" }, { status: 400 });
  }
  try {
    await sb.rest(
      "DELETE",
      `favorites?user_id=eq.${encodeURIComponent(userId)}&ad_token=eq.${encodeURIComponent(adToken)}`
    );
    return NextResponse.json({ ok: true, data: { adToken } });
  } catch (e) {
    console.warn("[favorites/delete]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
