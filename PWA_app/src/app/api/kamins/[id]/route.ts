import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { removeKamin } from "@/lib/server/kamin/engine";

/** DELETE /api/kamins/:id — disarm (two-step confirm in the UI). */
export async function DELETE(
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
  const { id } = await params;
  await removeKamin(supabaseServer()!, userId, id);
  return NextResponse.json({ ok: true });
}
