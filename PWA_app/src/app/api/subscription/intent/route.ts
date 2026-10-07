import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import {
  createIntent,
  SubscriptionError,
} from "@/lib/server/subscription/lifecycle";

/**
 * POST /api/subscription/intent — MVP purchase intent (blueprint §9).
 * Body: { tier: "paye"|"herfei"|"vizhe"|"namayandegi"|"almas",
 *         billing?: "monthly"|"annual" }.
 * Idempotent per user: an existing pending/active subscription is
 * returned as-is. No charging — the gateway plugs into this intent later.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "auth-required", message: "برای خرید اشتراک وارد شوید." },
      { status: 401 }
    );
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let body: { tier?: unknown; billing?: unknown } = {};
  try {
    body = (await req.json()) as { tier?: unknown; billing?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  try {
    const { subscription, created } = await createIntent(
      supabaseServer()!,
      userId,
      body.tier,
      body.billing
    );
    return NextResponse.json(
      {
        ok: true,
        data: {
          subscription,
          created,
          message: "درخواستت ثبت شد — به‌زودی برای فعال‌سازی خبرت می‌کنیم.",
        },
      },
      { status: created ? 201 : 200 }
    );
  } catch (e) {
    if (e instanceof SubscriptionError) {
      const status = e.code === "invalid-tier" || e.code === "invalid-billing" ? 400 : 500;
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status }
      );
    }
    throw e;
  }
}
