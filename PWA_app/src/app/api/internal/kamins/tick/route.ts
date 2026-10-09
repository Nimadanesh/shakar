import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  tickDueKamins,
  realEnginePipeline,
  type EngineDeps,
} from "@/lib/server/kamin/engine";
import { sendPushToUser } from "@/lib/server/push";

/**
 * POST /api/internal/kamins/tick — the kamin cadence runner.
 *
 * Called by a scheduler (Railway cron / cron-job.org) every few minutes with
 * the CRON_SECRET header. NOT a public endpoint: without the secret → 403;
 * without CRON_SECRET configured → 503 (fail-closed, never an open runner).
 *
 * Each tick runs every DUE active kamin sequentially (the Divar throttle is
 * global and jittered — parallel checks would just queue behind it).
 */
export async function POST(req: Request) {
  // trim(): pasted secrets often smuggle a trailing space/newline from the
  // Railway variable editor — an invisible mismatch that 403s forever.
  // (Same guard as /api/internal/quota/grant: all CRON_SECRET-guarded
  // routes must trim identically, or one accepts a secret another rejects.)
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret")?.trim() !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const sb = supabaseConfigured() ? supabaseServer() : null;
  const pipeline = realEnginePipeline();
  const deps: EngineDeps = {
    sb,
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    collect: pipeline.collect,
    confirm: pipeline.confirm,
    sendPush: (userId, payload) =>
      sendPushToUser(sb, userId, payload).then(() => {}),
  };
  const summary = await tickDueKamins(deps);
  return NextResponse.json({ ok: true, data: summary });
}
