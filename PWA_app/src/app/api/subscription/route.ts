import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  expireCheck,
  getSubscription,
} from "@/lib/server/subscription/lifecycle";
import { currentPrices } from "@/lib/server/subscription/prices";

/**
 * GET /api/subscription — current tier, usage, renewal date, prices
 * (blueprint §1.3). Runs the lazy expiry check: a past-due cycle flips
 * to expired and sleeps the kamins before anything is returned.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;

  const subscription = await expireCheck(sb, userId);
  const prices = await currentPrices(sb);

  let usage: {
    hunts_used: number;
    gifts_used: number;
    cycle_start: string | null;
  } | null = null;
  try {
    const rows = await sb.rest<
      Array<{ hunts_used: number; gifts_used: number; cycle_start: string }>
    >(
      "GET",
      `quota_counters?user_id=eq.${encodeURIComponent(userId)}` +
        `&select=hunts_used,gifts_used,cycle_start&limit=1`
    );
    if (rows[0]) {
      usage = {
        hunts_used: Number(rows[0].hunts_used ?? 0),
        gifts_used: Number(rows[0].gifts_used ?? 0),
        cycle_start: rows[0].cycle_start ?? null,
      };
    }
  } catch {
    usage = null;
  }

  // Fresh read after a possible expiry flip (expireCheck may return the
  // pre-flip row on a failed PATCH — re-read for honesty).
  const live = subscription?.status === "active" ? await getSubscription(sb, userId) : subscription;

  return NextResponse.json({
    ok: true,
    data: {
      subscription: live ?? null,
      usage,
      prices,
      renewalDate: live?.cycle_ends_at ?? null,
    },
  });
}
