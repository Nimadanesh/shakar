import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOtpConfig } from "@/lib/otp/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/otp/session";
import { createRun } from "@/lib/server/hunt/runs";
import type { HuntDefinition } from "@/lib/server/hunt/pipeline";

/**
 * POST /api/hunts — fire a hunt. Validates the definition, creates the run,
 * and returns the run id IMMEDIATELY (202). The pipeline runs on
 * GET /api/hunts/[id]/stream (SSE), so the client never holds a dead
 * request and the progress UI can render staged copy.
 *
 * Quota: M4a consumes optimistically (Supabase when configured, permissive
 * dev mode otherwise). The transactional quota engine (row lock,
 * idempotency, gifts, refunds, 85% notification) ships in M4b with the SQL.
 */
function toHuntDefinition(body: unknown): HuntDefinition | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const query = str(b.query).trim();
  if (query === "") return null;
  const transaction = b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "";
  const condition =
    b.condition === "new" || b.condition === "used" || b.condition === "any"
      ? b.condition
      : "";
  return {
    query,
    include: strArr(b.include),
    exclude: strArr(b.exclude),
    city: str(b.city) || "all",
    category: str(b.category) || "all",
    priceMin: str(b.priceMin),
    priceMax: str(b.priceMax),
    transaction,
    condition,
    deepHistory: b.deepHistory === true,
  };
}

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const def = toHuntDefinition(body);
  if (!def) {
    return NextResponse.json({ ok: false, error: "bad-definition" }, { status: 400 });
  }

  // Best-effort user id (guests allowed in M4a; M4b enforces guest quota).
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

  const run = createRun(def, userId);
  return NextResponse.json({ ok: true, data: { runId: run.id } }, { status: 202 });
}
