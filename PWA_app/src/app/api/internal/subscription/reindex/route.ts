import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  reindexPrices,
  SubscriptionError,
} from "@/lib/server/subscription/lifecycle";

/**
 * POST /api/internal/subscription/reindex — manual dollar re-index
 * (navid-approved manual flow, M6).
 * Body: { dollar_rate_toman: number }.
 *
 * Same guard as the kamin tick: x-cron-secret must match CRON_SECRET,
 * fail-closed 503 when unconfigured. Records the new rate, inserts
 * fresh tier_prices rows for every tier/billing. Existing subscription
 * rows are never rewritten — annuals stay grandfathered; monthly
 * subscriptions pick up the new price on their next cycle.
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
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let body: { dollar_rate_toman?: unknown } = {};
  try {
    body = (await req.json()) as { dollar_rate_toman?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const rate = Number(body.dollar_rate_toman);
  try {
    const result = await reindexPrices(supabaseServer()!, rate);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof SubscriptionError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status: 400 }
      );
    }
    throw e;
  }
}
