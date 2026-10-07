import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  renewSubscription,
  SubscriptionError,
} from "@/lib/server/subscription/lifecycle";

function err(e: unknown) {
  if (e instanceof SubscriptionError) {
    const status =
      e.code === "not-found"
        ? 404
        : e.code === "forbidden"
          ? 403
          : e.code === "wrong-state"
            ? 409
            : 400;
    return NextResponse.json(
      { ok: false, error: e.code, message: e.message },
      { status }
    );
  }
  throw e;
}

/**
 * POST /api/subscription/renew — extend the cycle (blueprint §1.3).
 * Body: { subscription_id, idempotency_key? }.
 *
 * A fresh cycle starts (from the later of now / current end), quotas
 * reset, sleeping kamins wake (slot-capped). Idempotent per
 * idempotency key: a repeated call with the same key is a no-op.
 * Post-MVP this is the payment-gateway hook; in the MVP it is the
 * renewal logic the hook will call.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let body: { subscription_id?: unknown; idempotency_key?: unknown } = {};
  try {
    body = (await req.json()) as {
      subscription_id?: unknown;
      idempotency_key?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  if (typeof body.subscription_id !== "string" || !body.subscription_id) {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const key =
    typeof body.idempotency_key === "string" && body.idempotency_key
      ? body.idempotency_key
      : null;
  try {
    const { subscription, renewed } = await renewSubscription(
      supabaseServer()!,
      userId,
      body.subscription_id,
      key
    );
    return NextResponse.json({ ok: true, data: { subscription, renewed } });
  } catch (e) {
    return err(e);
  }
}
