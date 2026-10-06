import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOtpConfig } from "@/lib/otp/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/otp/session";
import { claimIdempotency, createRun } from "@/lib/server/hunt/runs";
import { consumeHunt } from "@/lib/server/quota";
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
  const rawKey = (body as Record<string, unknown>).idempotencyKey;
  const idempotencyKey = typeof rawKey === "string" && rawKey !== "" ? rawKey : null;
  if (idempotencyKey) {
    const claim = claimIdempotency(idempotencyKey);
    if (!claim.fresh) {
      return NextResponse.json({ ok: true, data: { runId: claim.runId, deduped: true } }, { status: 202 });
    }
  }

  // Quota gate.
  const deviceId = req.headers.get("x-device-id")?.trim() || "unknown";
  const quota = await consumeHunt({ userId, deviceId });
  if (!quota.allowed) {
    const status = quota.reason === "suspended" ? 403 : 402;
    return NextResponse.json(
      { ok: false, error: quota.reason, message: quota.message },
      { status }
    );
  }

  const run = createRun(def, userId, {
    kind: quota.kind,
    mode: quota.mode,
    userId: quota.userId,
    deviceId,
    charged: true,
  }, idempotencyKey ?? undefined);
  return NextResponse.json(
    { ok: true, data: { runId: run.id, remaining: quota.remaining } },
    { status: 202 }
  );
}
