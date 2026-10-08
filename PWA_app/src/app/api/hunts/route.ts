import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOtpConfig } from "@/lib/otp/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/otp/session";
import { claimIdempotency, createRun, releaseIdempotency } from "@/lib/server/hunt/runs";
import { clientIp, consumeHunt } from "@/lib/server/quota";
import { supabaseServer } from "@/lib/supabase-server";
import { resolveHuntDefinition } from "@/lib/server/hunt/definition";

/**
 * POST /api/hunts — fire a hunt.
 *  1. Validate the definition (400 on garbage).
 *  2. Idempotency: same key → the ORIGINAL run id (one tap = one hunt).
 *  3. Quota gate: 402 quota exhausted, 403 suspended — Persian, honest,
 *     never any per-hunt pricing language.
 *  4. Create the run, return 202 + run id immediately. The pipeline runs on
 *     GET /api/hunts/[id]/stream (SSE).
 */
export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const def = resolveHuntDefinition(body);
  if (!def) {
    return NextResponse.json({ ok: false, error: "bad-definition" }, { status: 400 });
  }

  // Best-effort user id (guests allowed; M4b enforces guest quota).
  let userId: string | null = null;
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value ?? null;
    if (token) {
      const config = getOtpConfig();
      const claims = await verifySessionToken(token, config.sessionSecret);
      userId = claims?.userId ?? null;
    }
  } catch {
    userId = null;
  }

  // Idempotency: a retried tap returns the original run, never a new hunt.
  // The claim pre-generates the run id; createRun MUST use it so the key
  // and the row agree (finding #9).
  const rawKey = (body as Record<string, unknown>).idempotencyKey;
  const idempotencyKey = typeof rawKey === "string" && rawKey !== "" ? rawKey : null;
  let claimedRunId: string | undefined;
  if (idempotencyKey) {
    const claim = await claimIdempotency(idempotencyKey);
    if (!claim.fresh) {
      return NextResponse.json({ ok: true, data: { runId: claim.runId, deduped: true } }, { status: 202 });
    }
    claimedRunId = claim.runId;
  }

  // Quota gate.
  const deviceId = req.headers.get("x-device-id")?.trim() || "unknown";
  const quota = await consumeHunt({ userId, deviceId, ip: clientIp(req) });
  if (!quota.allowed) {
    // The key was claimed but no hunt will run — release it so a later tap
    // can claim fresh. No quota was consumed, so nothing is lost.
    if (idempotencyKey) await releaseIdempotency(idempotencyKey);
    const status = quota.reason === "suspended" ? 403 : 402;
    return NextResponse.json(
      { ok: false, error: quota.reason, message: quota.message },
      { status }
    );
  }

  const run = await createRun(def, userId, {
    kind: quota.kind,
    mode: quota.mode,
    userId: quota.userId,
    deviceId,
    poolKey: quota.poolKey,
    charged: true,
  }, idempotencyKey ?? undefined, undefined, claimedRunId);

  // Cross-device profile: log the firing for the 14-day chart
  // (supabase/m7-hunt-events.sql). Best-effort — quota was already
  // consumed; a failed insert only gaps the chart, never the hunt.
  // Only fresh firings are logged: deduped retries return above.
  logHuntEvent({ userId: quota.userId, kind: quota.kind, deviceId, query: def.query });

  return NextResponse.json(
    { ok: true, data: { runId: run.id, remaining: quota.remaining } },
    { status: 202 }
  );
}

/** UUID-shaped device ids only — "unknown" and garbage never touch the DB. */
function validDeviceId(id: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function logHuntEvent(opts: {
  userId: string | null;
  kind: "standard" | "guest";
  deviceId: string;
  query: string;
}): void {
  try {
    const sb = supabaseServer();
    if (!sb) return;
    const row: Record<string, string | null> = {
      user_id: opts.kind === "standard" ? opts.userId : null,
      device_id: opts.kind === "guest" ? validDeviceId(opts.deviceId) : null,
      query: opts.query.slice(0, 200),
    };
    // Fire-and-forget: never block the 202 on a display-only insert.
    void sb
      .rest("POST", "hunt_events", row)
      .catch((e: unknown) =>
        console.warn("[hunts] hunt_event insert failed:", (e as Error).message)
      );
  } catch (e) {
    console.warn("[hunts] hunt_event insert failed:", (e as Error).message);
  }
}
