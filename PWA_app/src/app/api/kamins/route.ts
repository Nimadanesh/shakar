import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { toHuntDefinition } from "@/lib/server/hunt/definition";
import {
  armKamin,
  listKamins,
  KaminError,
  type Sb,
} from "@/lib/server/kamin/engine";

/**
 * GET /api/kamins — the user's kamins, newest first.
 * POST /api/kamins — arm a kamin (blueprint §1.8).
 *   Body: { name?, definition, seenIds? }
 *   - consumes one kamin slot (tier slots: 1/3/5/8/15);
 *   - same canonical_key → the EXISTING kamin (dedupe, not an error);
 *   - no active subscription → armed SLEEPING (guest funnel), no slot taken;
 *   - 402 when the tier's slots are full — Persian, honest, never any
 *     per-hunt pricing language.
 */

async function activeTier(sb: Sb, userId: string): Promise<string | null> {
  try {
    const rows = await sb.rest<Array<{ tier: string; status: string }>>(
      "GET",
      `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=tier,status&limit=1`
    );
    const s = rows[0];
    return s && s.status === "active" ? s.tier : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const kamins = await listKamins(supabaseServer()!, userId);
  return NextResponse.json({ ok: true, data: { kamins } });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "auth-required", message: "برای فعال‌سازی کمین وارد شوید." },
      { status: 401 }
    );
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const def = toHuntDefinition(b.definition ?? b);
  if (!def) {
    return NextResponse.json({ ok: false, error: "bad-definition" }, { status: 400 });
  }
  const name =
    typeof b.name === "string" && b.name.trim() !== ""
      ? b.name.trim().slice(0, 60)
      : def.query.slice(0, 60);
  const seenIds = Array.isArray(b.seenIds)
    ? b.seenIds.filter((x): x is string => typeof x === "string").slice(0, 500)
    : [];

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const tier = await activeTier(sb, userId);
  try {
    const { kamin, created } = await armKamin(sb, {
      userId,
      name,
      definition: def,
      seenIds,
      tier,
    });
    return NextResponse.json(
      { ok: true, data: { kamin, created } },
      { status: created ? 201 : 200 }
    );
  } catch (e) {
    if (e instanceof KaminError) {
      const status = e.code === "slots-full" ? 402 : 400;
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status }
      );
    }
    throw e;
  }
}
