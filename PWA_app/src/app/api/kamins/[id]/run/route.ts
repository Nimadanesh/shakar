import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { toHuntDefinition } from "@/lib/server/hunt/definition";
import { claimIdempotency, createRun } from "@/lib/server/hunt/runs";
import { consumeHunt } from "@/lib/server/quota";
import type { KaminRow } from "@/lib/server/kamin/engine";

/**
 * POST /api/kamins/:id/run — «دیدن نتایج»: an EXPLICIT new hunt from a
 * kamin (blueprint §1.8). Consumes hunt quota like any hunt (honors the
 * big-hunt flow downstream); the stream route moves the kamin's seen
 * baseline only after the hunt succeeds.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "auth-required", message: "برای دیدن نتایج وارد شوید." },
      { status: 401 }
    );
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const { id } = await params;
  const rows = await sb.rest<KaminRow[]>(
    "GET",
    `kamins?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
  );
  const kamin = rows[0];
  if (!kamin) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const def = toHuntDefinition(kamin.definition);
  if (!def) {
    return NextResponse.json({ ok: false, error: "bad-definition" }, { status: 400 });
  }

  const rawKey = req.headers.get("Idempotency-Key");
  const idempotencyKey = rawKey && rawKey !== "" ? rawKey : null;
  if (idempotencyKey) {
    const claim = claimIdempotency(idempotencyKey);
    if (!claim.fresh) {
      return NextResponse.json(
        { ok: true, data: { runId: claim.runId, deduped: true } },
        { status: 202 }
      );
    }
  }

  const deviceId = req.headers.get("x-device-id")?.trim() || "unknown";
  const quota = await consumeHunt({ userId, deviceId });
  if (!quota.allowed) {
    const status = quota.reason === "suspended" ? 403 : 402;
    return NextResponse.json(
      { ok: false, error: quota.reason, message: quota.message },
      { status }
    );
  }

  const run = createRun(
    def,
    userId,
    {
      kind: quota.kind,
      mode: quota.mode,
      userId: quota.userId,
      deviceId,
      charged: true,
    },
    idempotencyKey ?? undefined,
    kamin.id
  );
  return NextResponse.json(
    { ok: true, data: { runId: run.id, remaining: quota.remaining } },
    { status: 202 }
  );
}
