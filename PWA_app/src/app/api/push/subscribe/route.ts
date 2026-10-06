import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";

/**
 * POST /api/push/subscribe — register this device for Web Push.
 *   Body: { endpoint, keys: { p256dh, auth } }
 * DELETE /api/push/subscribe — unregister this device.
 *   Body: { endpoint }
 *
 * Called after Notification.requestPermission() grants — i.e. on an
 * explicit user action (arming a kamin), never silently.
 */

function validSub(body: Record<string, unknown>): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  const endpoint = body.endpoint;
  const keys = body.keys as Record<string, unknown> | undefined;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 2000 ||
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string" ||
    keys.p256dh.length === 0 ||
    keys.auth.length === 0 ||
    keys.p256dh.length > 500 ||
    keys.auth.length > 500
  ) {
    return null;
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const sub = validSub((body ?? {}) as Record<string, unknown>);
  if (!sub) {
    return NextResponse.json({ ok: false, error: "bad-subscription" }, { status: 400 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  const eu = encodeURIComponent(userId);
  const ee = encodeURIComponent(sub.endpoint);
  const existing = await sb.rest<Array<{ id: string }>>(
    "GET",
    `push_subscriptions?user_id=eq.${eu}&endpoint=eq.${ee}&select=id&limit=1`
  );
  if (existing[0]) {
    await sb.rest("PATCH", `push_subscriptions?id=eq.${existing[0].id}`, {
      p256dh: sub.p256dh,
      auth: sub.auth,
    });
  } else {
    await sb.rest("POST", "push_subscriptions", {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const endpoint = (body as Record<string, unknown> | null)?.endpoint;
  if (typeof endpoint !== "string" || endpoint === "") {
    return NextResponse.json({ ok: false, error: "bad-endpoint" }, { status: 400 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const sb = supabaseServer()!;
  await sb.rest(
    "DELETE",
    `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`
  );
  return NextResponse.json({ ok: true });
}
