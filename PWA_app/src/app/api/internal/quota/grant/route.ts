import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/internal/quota/grant — top up one user's or device's hunt quota.
 *
 * Support tooling (navid 2026-10-08): the founder hit his own quota wall
 * while testing, and there was no way to grant hunts without hand-editing
 * rows. Same guard as the kamin tick: x-cron-secret must match
 * CRON_SECRET; without the secret configured → 503 (fail-closed).
 *
 * Body: { userId?: string, deviceId?: string, hunts: number }
 *  - exactly one of userId / deviceId; both must be UUIDs (typos fail fast
 *    instead of creating junk rows);
 *  - hunts: integer 1..100.
 *
 * Semantics mirror the pool keying (finding #15):
 *  - userId with a quota_counters row (subscriber) → gives back n consumed
 *    units: hunts_used = max(0, hunts_used - n);
 *  - userId without one (registered-but-unsubscribed) → extends the
 *    userId-keyed guest pool: free_hunts_granted += n;
 *  - deviceId → extends the device-keyed guest pool: free_hunts_granted += n.
 * Never touches free_hunts_used, so a grant can never destroy anything.
 */
function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  // trim(): pasted secrets often smuggle a trailing space/newline from the
  // Railway variable editor — an invisible mismatch that 403s forever.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron-not-configured" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret")?.trim() !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const { userId, deviceId, hunts } = (body ?? {}) as {
    userId?: unknown;
    deviceId?: unknown;
    hunts?: unknown;
  };
  const n = typeof hunts === "number" ? Math.floor(hunts) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return NextResponse.json({ ok: false, error: "hunts must be an integer 1..100" }, { status: 400 });
  }
  const hasUser = isUuid(userId);
  const hasDevice = isUuid(deviceId);
  if (hasUser === hasDevice) {
    return NextResponse.json(
      { ok: false, error: "exactly one of userId/deviceId, both must be UUIDs" },
      { status: 400 }
    );
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase-not-configured" }, { status: 503 });
  }
  const sb = supabaseServer();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "supabase-not-configured" }, { status: 503 });
  }
  const key = (hasUser ? userId : deviceId) as string;
  const q = encodeURIComponent(key);

  if (hasUser) {
    // Subscriber path: give back n consumed units (never below zero).
    const rows = await sb.rest<Array<{ hunts_used: number }>>(
      "GET",
      `quota_counters?user_id=eq.${q}&select=hunts_used`
    );
    if (rows.length > 0) {
      const used = Math.max(0, Number(rows[0].hunts_used ?? 0) - n);
      await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, { hunts_used: used });
      return NextResponse.json({
        ok: true,
        data: { pool: "subscription", key, huntsGranted: n, huntsUsed: used },
      });
    }
    // No subscription row → falls through to the userId-keyed guest pool.
  }

  // Guest-pool path: extend the grant. Read-then-write is fine for a
  // human-operated support tool; each statement is atomic.
  const drows = await sb.rest<
    Array<{ free_hunts_used: number; free_hunts_granted: number }>
  >("GET", `devices?id=eq.${q}&select=free_hunts_used,free_hunts_granted`);
  if (drows.length === 0) {
    await sb.rest("POST", "devices", {
      id: key,
      fingerprint_hash: key,
      free_hunts_used: 0,
      free_hunts_granted: n,
    });
    return NextResponse.json({
      ok: true,
      data: { pool: "guest", key, huntsGranted: n, freeHuntsUsed: 0, freeHuntsGranted: n },
    });
  }
  const granted = Number(drows[0].free_hunts_granted ?? 0) + n;
  await sb.rest("PATCH", `devices?id=eq.${q}`, { free_hunts_granted: granted });
  return NextResponse.json({
    ok: true,
    data: {
      pool: "guest",
      key,
      huntsGranted: n,
      freeHuntsUsed: drows[0].free_hunts_used,
      freeHuntsGranted: granted,
    },
  });
}
