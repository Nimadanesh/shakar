import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

interface HiddenAdRow {
  ad_token: string;
  created_at: string;
}

/**
 * GET /api/me/hidden-ads — the logged-in user's hidden ad tokens.
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
    const rows = await sb.rest<HiddenAdRow[]>(
      "GET",
      `hidden_ads?user_id=eq.${encodeURIComponent(userId)}&select=ad_token,created_at&order=created_at.desc&limit=500`
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (e) {
    console.warn("[hidden-ads/get]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}

/**
 * POST /api/me/hidden-ads — hide an ad { adToken }.
 * Idempotent: re-hiding the same ad is a no-op (unique constraint).
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
  } | null;
  const adToken = typeof body?.adToken === "string" ? body.adToken.trim() : "";
  if (adToken === "") {
    return NextResponse.json({ ok: false, error: "empty-token" }, { status: 400 });
  }
  try {
    await sb.rest(
      "POST",
      "/hidden_ads",
      { user_id: userId, ad_token: adToken },
      "resolution=ignore-duplicates"
    );
    return NextResponse.json({ ok: true, data: { adToken } });
  } catch (e) {
    console.warn("[hidden-ads/post]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/me/hidden-ads?adToken=… — unhide an ad (ownership checked).
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
      `/hidden_ads?user_id=eq.${encodeURIComponent(userId)}` +
        `&ad_token=eq.${encodeURIComponent(adToken)}`
    );
    return NextResponse.json({ ok: true, data: { adToken } });
  } catch (e) {
    console.warn("[hidden-ads/delete]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
