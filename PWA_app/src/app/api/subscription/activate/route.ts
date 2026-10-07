import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  activateSubscription,
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
          : e.code === "wrong-state" || e.code === "seats-full"
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
 * POST /api/subscription/activate — MVP TEST activation.
 * Body: { subscription_id }.
 *
 * There is no payment gateway yet, so the owner may activate their OWN
 * pending intent. This step is replaced by the gateway webhook — the
 * lifecycle (pending → active, cycle start, quota reset, kamin wake)
 * is what this endpoint proves, not the payment.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let body: { subscription_id?: unknown } = {};
  try {
    body = (await req.json()) as { subscription_id?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  if (typeof body.subscription_id !== "string" || !body.subscription_id) {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  try {
    const subscription = await activateSubscription(
      supabaseServer()!,
      userId,
      body.subscription_id
    );
    return NextResponse.json({ ok: true, data: { subscription } });
  } catch (e) {
    return err(e);
  }
}
