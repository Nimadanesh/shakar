import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { checkCronSecret } from "@/lib/server/cronAuth";
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
  // M3 (2026-10-15): timing-safe shared guard (was `!==` comparison).
  const auth = checkCronSecret(req, "not-configured");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
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
